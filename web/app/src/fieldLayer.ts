// MapLibre custom layer that draws a forecast field. It decodes the encoded
// frames on the GPU, interpolates between two forecast steps, maps values
// through a palette and, for pressure, draws isobars.

import type { CustomLayerInterface, CustomRenderMethod, Map as MapLibreMap } from "maplibre-gl";
import type { LayerInfo } from "./data";
import type { Frame } from "./frames";
import { paletteBytes, SCALES } from "./palettes";

const VERTEX = `#version 300 es
in vec2 a_pos;
uniform mat4 u_matrix;
out vec2 v_merc;
void main() {
  v_merc = a_pos;
  gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
in vec2 v_merc;
uniform highp sampler2D u_frame0;
uniform highp sampler2D u_frame1;
uniform sampler2D u_palette;
uniform float u_ratio;
uniform int u_encoding;      // 0 scalar16, 1 uv12, 2 precip
uniform vec2 u_range;        // encoded min, max
uniform vec2 u_domain;       // palette domain
uniform int u_sqrtAxis;
uniform float u_opacity;
uniform float u_isoline;     // isoline interval; 0 disables
out vec4 fragColor;

const float PI = 3.141592653589793;

vec4 decodeTexel(vec3 c) {
  vec3 b = floor(c * 255.0 + 0.5);
  float span = u_range.y - u_range.x;
  if (u_encoding == 1) {
    float u = b.r * 16.0 + floor(b.b / 16.0);
    float v = b.g * 16.0 + mod(b.b, 16.0);
    return vec4(u_range.x + u / 4095.0 * span, u_range.x + v / 4095.0 * span, 0.0, 0.0);
  }
  float value = u_range.x + (b.r * 256.0 + b.g) / 65535.0 * span;
  if (u_encoding == 2) {
    return vec4(value, mod(b.b, 128.0) / 1.27, step(128.0, b.b), 0.0);
  }
  return vec4(value, 0.0, 0.0, 0.0);
}

vec4 sampleGrid(highp sampler2D frame, vec2 grid) {
  ivec2 size = textureSize(frame, 0);
  vec2 base = floor(grid);
  vec2 f = grid - base;
  int x0 = int(mod(base.x, float(size.x)));
  int x1 = int(mod(base.x + 1.0, float(size.x)));
  int y0 = clamp(int(base.y), 0, size.y - 1);
  int y1 = clamp(int(base.y) + 1, 0, size.y - 1);
  vec4 a = decodeTexel(texelFetch(frame, ivec2(x0, y0), 0).rgb);
  vec4 b = decodeTexel(texelFetch(frame, ivec2(x1, y0), 0).rgb);
  vec4 c = decodeTexel(texelFetch(frame, ivec2(x0, y1), 0).rgb);
  vec4 d = decodeTexel(texelFetch(frame, ivec2(x1, y1), 0).rgb);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  float lon = fract(v_merc.x) * 360.0 - 180.0;
  float y = PI * (1.0 - 2.0 * v_merc.y);
  float lat = degrees(atan(0.5 * (exp(y) - exp(-y))));
  ivec2 size = textureSize(u_frame0, 0);
  float cell = 360.0 / float(size.x);
  vec2 grid = vec2((lon + 180.0) / cell, (90.0 - lat) / cell);
  vec4 value = mix(sampleGrid(u_frame0, grid), sampleGrid(u_frame1, grid), u_ratio);

  float magnitude = u_encoding == 1 ? length(value.xy) : value.x;
  float t = clamp((magnitude - u_domain.x) / (u_domain.y - u_domain.x), 0.0, 1.0);
  if (u_sqrtAxis == 1) t = sqrt(t);
  float row = u_encoding == 2 ? (value.z > 0.5 ? 0.75 : 0.25) : 0.5;
  vec3 color = texture(u_palette, vec2(t, row)).rgb;
  float alpha = u_opacity;

  if (u_encoding == 2) {
    // Rain and snow fade in from 0.05 mm/h; clouds show as a grey veil.
    float wet = smoothstep(0.05, 0.4, value.x);
    float cloud = clamp(value.y / 100.0, 0.0, 1.0) * 0.45;
    color = mix(vec3(0.82, 0.84, 0.88), color, wet);
    alpha = u_opacity * max(wet, cloud);
  }

  if (u_isoline > 0.0) {
    float level = magnitude / u_isoline;
    float width = fwidth(level);
    float line = abs(fract(level - 0.5) - 0.5) / max(width, 1e-4);
    float ink = 1.0 - smoothstep(0.6, 1.6, line);
    color = mix(color, vec3(1.0), ink * 0.55);
  }
  fragColor = vec4(color * alpha, alpha);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
}

export class FieldLayer implements CustomLayerInterface {
  readonly id = "forecast-field";
  readonly type = "custom" as const;
  readonly renderingMode = "2d" as const;

  private map?: MapLibreMap;
  private gl?: WebGL2RenderingContext;
  private program?: WebGLProgram;
  private buffer?: WebGLBuffer;
  private palette?: WebGLTexture;
  private textures = new Map<string, WebGLTexture>();
  private layer?: LayerInfo;
  private frames: [Frame, Frame] | null = null;
  private ratio = 0;
  opacity = 0.85;

  onAdd(map: MapLibreMap, context: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (!(typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext)) {
      throw new Error("이 브라우저는 WebGL2를 지원하지 않아 예보 지도를 그릴 수 없습니다.");
    }
    const gl = context;
    this.map = map;
    this.gl = gl;
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
    }
    this.program = program;
    // Three world copies so the field wraps across the antimeridian.
    const quads: number[] = [];
    for (const offset of [-1, 0, 1]) {
      const [x0, x1] = [offset, offset + 1];
      quads.push(x0, 0, x1, 0, x0, 1, x0, 1, x1, 0, x1, 1);
    }
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quads), gl.STATIC_DRAW);
  }

  setLayer(layer: LayerInfo | undefined): void {
    this.layer = layer;
    this.frames = null;
    const gl = this.gl;
    if (gl && layer) {
      const { data, rows } = paletteBytes(layer.id);
      if (!this.palette) this.palette = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, this.palette);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    this.map?.triggerRepaint();
  }

  setFrames(frames: [Frame, Frame], ratio: number): void {
    this.frames = frames;
    this.ratio = ratio;
    this.map?.triggerRepaint();
  }

  private texture(frame: Frame): WebGLTexture {
    const gl = this.gl!;
    let texture = this.textures.get(frame.key);
    if (texture) return texture;
    texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, frame.bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.textures.set(frame.key, texture);
    // Keep a handful of uploaded frames for scrubbing back and forth.
    while (this.textures.size > 6) {
      const [oldest, stale] = this.textures.entries().next().value as [string, WebGLTexture];
      gl.deleteTexture(stale);
      this.textures.delete(oldest);
    }
    return texture;
  }

  render: CustomRenderMethod = (context, matrix) => {
    const gl = context as WebGL2RenderingContext;
    if (!this.program || !this.layer || !this.frames || !this.palette) return;
    const scale = SCALES[this.layer.id];
    gl.useProgram(this.program);
    const uniform = (name: string) => gl.getUniformLocation(this.program!, name);
    gl.uniformMatrix4fv(uniform("u_matrix"), false, matrix as unknown as Float32Array);
    const units: [string, WebGLTexture][] = [
      ["u_frame0", this.texture(this.frames[0])],
      ["u_frame1", this.texture(this.frames[1])],
      ["u_palette", this.palette],
    ];
    units.forEach(([name, texture], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uniform(name), unit);
    });
    const encoding = { scalar16: 0, uv12: 1, precip: 2 }[this.layer.encoding];
    gl.uniform1f(uniform("u_ratio"), this.ratio);
    gl.uniform1i(uniform("u_encoding"), encoding);
    gl.uniform2f(uniform("u_range"), this.layer.min, this.layer.max);
    gl.uniform2f(uniform("u_domain"), scale.domain[0], scale.domain[1]);
    gl.uniform1i(uniform("u_sqrtAxis"), this.layer.id === "precipitation" ? 1 : 0);
    gl.uniform1f(uniform("u_opacity"), this.opacity);
    gl.uniform1f(uniform("u_isoline"), this.layer.id === "pressure" ? 4 : 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer!);
    const position = gl.getAttribLocation(this.program, "a_pos");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 18);
  };

  onRemove(): void {
    const gl = this.gl;
    if (!gl) return;
    this.textures.forEach((texture) => gl.deleteTexture(texture));
    this.textures.clear();
    if (this.palette) gl.deleteTexture(this.palette);
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
  }
}
