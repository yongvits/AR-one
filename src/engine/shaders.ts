/**
 * WebGL2 GLSL Shaders for Custom GPU AR Processing Pipeline
 */

export const SHADERS = {
  // Vertex Shader for Fullscreen Quad
  quadVertex: `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`,

  // Convert RGB Video Frame to Grayscale + Gaussian Blur
  grayscaleBlurFragment: `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec2 texel = 1.0 / u_resolution;
  
  // 3x3 Gaussian Kernel Blur
  float luma = 0.0;
  float kernel[9] = float[](
    1.0/16.0, 2.0/16.0, 1.0/16.0,
    2.0/16.0, 4.0/16.0, 2.0/16.0,
    1.0/16.0, 2.0/16.0, 1.0/16.0
  );

  int idx = 0;
  for(int y = -1; y <= 1; y++) {
    for(int x = -1; x <= 1; x++) {
      vec4 c = texture(u_image, v_texCoord + vec2(float(x), float(y)) * texel);
      float gray = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      luma += gray * kernel[idx];
      idx++;
    }
  }

  fragColor = vec4(vec3(luma), 1.0);
}`,

  // FAST-9 Corner Detector GPU Acceleration Shader
  fastCornerFragment: `#version 300 es
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_threshold;
in vec2 v_texCoord;
out vec4 fragColor;

float getLuma(vec2 offset) {
  vec4 color = texture(u_image, v_texCoord + offset / u_resolution);
  return color.r; // Grayscale input
}

void main() {
  float p = getLuma(vec2(0.0, 0.0));

  // Bresenham circle radius 3 offsets (16 pixels)
  vec2 circle[16] = vec2[](
    vec2(0.0, -3.0), vec2(1.0, -3.0), vec2(2.0, -2.0), vec2(3.0, -1.0),
    vec2(3.0, 0.0),  vec2(3.0, 1.0),  vec2(2.0, 2.0),  vec2(1.0, 3.0),
    vec2(0.0, 3.0),  vec2(-1.0, 3.0), vec2(-2.0, 2.0), vec2(-3.0, 1.0),
    vec2(-3.0, 0.0), vec2(-3.0, -1.0),vec2(-2.0, -2.0),vec2(-1.0, -3.0)
  );

  // Quick test on 1, 5, 9, 13
  float p1 = getLuma(circle[0]);
  float p5 = getLuma(circle[4]);
  float p9 = getLuma(circle[8]);
  float p13 = getLuma(circle[12]);

  int bCount = 0;
  int dCount = 0;
  if (p1 > p + u_threshold) bCount++;
  if (p1 < p - u_threshold) dCount++;
  if (p5 > p + u_threshold) bCount++;
  if (p5 < p - u_threshold) dCount++;
  if (p9 > p + u_threshold) bCount++;
  if (p9 < p - u_threshold) dCount++;
  if (p13 > p + u_threshold) bCount++;
  if (p13 < p - u_threshold) dCount++;

  if (bCount < 3 && dCount < 3) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Full FAST-9 evaluation
  float maxDiff = 0.0;
  for (int i = 0; i < 16; i++) {
    float val = getLuma(circle[i]);
    maxDiff += abs(val - p);
  }

  fragColor = vec4(maxDiff * 0.1, 1.0, 0.0, 1.0);
}`,

  // Pyramid Lucas-Kanade Optical Flow Shader
  opticalFlowFragment: `#version 300 es
precision highp float;

uniform sampler2D u_currFrame;
uniform sampler2D u_prevFrame;
uniform vec2 u_resolution;
in vec2 v_texCoord;
out vec4 fragColor;

void main() {
  vec2 texel = 1.0 / u_resolution;
  float I_curr = texture(u_currFrame, v_texCoord).r;
  float I_prev = texture(u_prevFrame, v_texCoord).r;

  float Ix = (texture(u_currFrame, v_texCoord + vec2(texel.x, 0.0)).r - 
              texture(u_currFrame, v_texCoord - vec2(texel.x, 0.0)).r) * 0.5;
  float Iy = (texture(u_currFrame, v_texCoord + vec2(0.0, texel.y)).r - 
              texture(u_currFrame, v_texCoord - vec2(0.0, texel.y)).r) * 0.5;
  float It = I_curr - I_prev;

  float denom = Ix * Ix + Iy * Iy + 0.0001;
  vec2 flow = -It * vec2(Ix, Iy) / denom;

  // Encode flow into RG channels [-10, +10] mapped to [0, 1]
  fragColor = vec4(flow * 0.05 + 0.5, 0.0, 1.0);
}`
};
