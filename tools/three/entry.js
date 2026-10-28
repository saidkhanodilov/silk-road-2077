// The parts of three.js that Silk Road 2077 uses. esbuild drops everything else,
// which keeps public/assets/vendor/three.min.js about 20% smaller than the full build.
// Rebuild with: cd tools/three && npm ci && npm run build
export {
  AdditiveBlending, BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CapsuleGeometry,
  CircleGeometry, Color, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry, Euler,
  ExtrudeGeometry, Fog, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh, Line, LineBasicMaterial,
  LineDashedMaterial, LineLoop, LineSegments, LinearFilter, MathUtils, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Object3D, Path, PerspectiveCamera, PlaneGeometry, Points, PointsMaterial, Quaternion,
  REVISION, RingGeometry, SRGBColorSpace, Scene, ShaderMaterial, Shape, ShapeGeometry, SphereGeometry, Sprite,
  SpriteMaterial, TextureLoader, TorusGeometry, Vector2, Vector3, WebGLRenderer,
} from 'three';
