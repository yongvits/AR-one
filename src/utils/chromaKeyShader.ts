import * as THREE from 'three';

/**
 * Custom Three.js Shader Material for Chroma Key (Green Screen Removal)
 * Ideal for Artivive-style video overlays on paintings and prints.
 */
export function createChromaKeyMaterial(
  texture: THREE.Texture,
  keyColorHex: string = '#00ff00',
  similarity: number = 0.4,
  smoothness: number = 0.1
): THREE.ShaderMaterial {
  const color = new THREE.Color(keyColorHex);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uKeyColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
      uSimilarity: { value: similarity },
      uSmoothness: { value: smoothness },
      uOpacity: { value: 1.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform vec3 uKeyColor;
      uniform float uSimilarity;
      uniform float uSmoothness;
      uniform float uOpacity;
      varying vec2 vUv;

      void main() {
        vec4 texColor = texture2D(uTexture, vUv);
        
        // Calculate RGB distance to key color
        float dist = distance(texColor.rgb, uKeyColor);
        
        // Smooth alpha transition around key color boundary
        float alpha = smoothstep(uSimilarity, uSimilarity + uSmoothness, dist);
        
        gl_FragColor = vec4(texColor.rgb, texColor.a * alpha * uOpacity);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  return material;
}
