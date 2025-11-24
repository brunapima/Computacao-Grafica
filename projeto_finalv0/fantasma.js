
// ----------------------------- utilidades de matriz (mini-mat4) -----------------------------
function degToRad(d){ return d * Math.PI / 180; }

const mat4 = {
  create: () => {
    const m = new Float32Array(16);
    m[0]=1; m[5]=1; m[10]=1; m[15]=1;
    return m;
  },
  multiply: (out, a, b) => {
    const o = out, A=a, B=b;
    for (let i=0;i<4;i++){
      const ai0=A[i], ai1=A[i+4], ai2=A[i+8], ai3=A[i+12];
      o[i]    = ai0*B[0] + ai1*B[1] + ai2*B[2] + ai3*B[3];
      o[i+4]  = ai0*B[4] + ai1*B[5] + ai2*B[6] + ai3*B[7];
      o[i+8]  = ai0*B[8] + ai1*B[9] + ai2*B[10]+ ai3*B[11];
      o[i+12] = ai0*B[12]+ ai1*B[13]+ ai2*B[14]+ ai3*B[15];
    }
    return o;
  },
  translate: (out, a, v) => {
    const x=v[0], y=v[1], z=v[2];
    if (a === out) {
      out[12] = a[0]*x + a[4]*y + a[8]*z + a[12];
      out[13] = a[1]*x + a[5]*y + a[9]*z + a[13];
      out[14] = a[2]*x + a[6]*y + a[10]*z + a[14];
      out[15] = a[3]*x + a[7]*y + a[11]*z + a[15];
      return out;
    }
    const m = mat4.create();
    m.set(a);
    m[12] = a[0]*x + a[4]*y + a[8]*z + a[12];
    m[13] = a[1]*x + a[5]*y + a[9]*z + a[13];
    m[14] = a[2]*x + a[6]*y + a[10]*z + a[14];
    m[15] = a[3]*x + a[7]*y + a[11]*z + a[15];
    out.set(m);
    return out;
  },
  perspective: (out, fovy, aspect, near, far) => {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[10] = (far + near) / (near - far); out[11] = -1;
    out[12]=0; out[13]=0; out[14] = (2*far*near)/(near - far); out[15]=0;
    return out;
  },
  lookAt: (out, eye, center, up) => {
    const z0 = eye[0]-center[0], z1 = eye[1]-center[1], z2 = eye[2]-center[2];
    let len = Math.hypot(z0,z1,z2);
    const zx = z0/len, zy = z1/len, zz = z2/len;
    const x0 = up[1]*zz - up[2]*zy;
    const x1 = up[2]*zx - up[0]*zz;
    const x2 = up[0]*zy - up[1]*zx;
    len = Math.hypot(x0,x1,x2) || 1;
    const xx = x0/len, xy = x1/len, xz = x2/len;
    const yx = zy*xz - zz*xy;
    const yy = zz*xx - zx*xz;
    const yz = zx*xy - zy*xx;
    out[0]=xx; out[1]=yx; out[2]=zx; out[3]=0;
    out[4]=xy; out[5]=yy; out[6]=zy; out[7]=0;
    out[8]=xz; out[9]=yz; out[10]=zz; out[11]=0;
    out[12]=-(xx*eye[0]+xy*eye[1]+xz*eye[2]);
    out[13]=-(yx*eye[0]+yy*eye[1]+yz*eye[2]);
    out[14]=-(zx*eye[0]+zy*eye[1]+zz*eye[2]);
    out[15]=1;
    return out;
  },
  fromTranslationRotationScale: (out, t, rDeg, s) => {
    const r = degToRad(rDeg);
    const c = Math.cos(r), si = Math.sin(r);
    out[0] = c * s[0]; out[1]=0; out[2]=-si*s[2]; out[3]=0;
    out[4] = 0; out[5]=s[1]; out[6]=0; out[7]=0;
    out[8] = si*s[0]; out[9]=0; out[10]=c*s[2]; out[11]=0;
    out[12]=t[0]; out[13]=t[1]; out[14]=t[2]; out[15]=1;
    return out;
  }
};

// ----------------------------- setup canvas & GL -----------------------------
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl', { antialias: true });
if (!gl) {
  alert('WebGL não disponível no seu navegador.');
  throw new Error('WebGL not supported');
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(canvas.clientWidth * dpr);
  const height = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0,0,canvas.width,canvas.height);
}
window.addEventListener('resize', resize);
canvas.style.width = '100%';
canvas.style.height = '100%';
resize();

// ----------------------------- shaders (vertex & fragment) -----------------------------
const vsSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uView;
uniform mat4 uProjection;
uniform mat4 uNormalMatrix;
varying vec3 vNormal;
varying vec3 vPos;
void main(){
  vec4 worldPos = uModel * vec4(aPosition, 1.0);
  vPos = worldPos.xyz;
  vNormal = mat3(uNormalMatrix) * aNormal;
  gl_Position = uProjection * uView * worldPos;
}
`;

const fsSource = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vPos;
uniform vec3 uLightDir; // normalized
uniform vec3 uColor;
uniform vec3 uAmbient;
void main(){
  vec3 N = normalize(vNormal);
  float diff = max(dot(N, -uLightDir), 0.0);
  vec3 diffuse = diff * uColor;
  vec3 color = uAmbient * uColor + diffuse;
  gl_FragColor = vec4(color, 1.0);
}
`;

// ----------------------------- shader compilation -----------------------------
function compileShader(gl, src, type) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(sh));
    throw new Error('Shader compile failed');
  }
  return sh;
}
function createProgram(gl, vs, fs) {
  const v = compileShader(gl, vs, gl.VERTEX_SHADER);
  const f = compileShader(gl, fs, gl.FRAGMENT_SHADER);
  const p = gl.createProgram();
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(p));
    throw new Error('Program link failed');
  }
  return p;
}

const program = createProgram(gl, vsSource, fsSource);
gl.useProgram(program);

// ----------------------------- attribute/uniform locations -----------------------------
const attribs = {
  position: gl.getAttribLocation(program, 'aPosition'),
  normal: gl.getAttribLocation(program, 'aNormal'),
};
const uniforms = {
  model: gl.getUniformLocation(program, 'uModel'),
  view: gl.getUniformLocation(program, 'uView'),
  projection: gl.getUniformLocation(program, 'uProjection'),
  normalMatrix: gl.getUniformLocation(program, 'uNormalMatrix'),
  lightDir: gl.getUniformLocation(program, 'uLightDir'),
  color: gl.getUniformLocation(program, 'uColor'),
  ambient: gl.getUniformLocation(program, 'uAmbient'),
};

// ----------------------------- geometry generation -----------------------------
function createCirclePoints(segments) {
  const pts = [];
  for (let i=0;i<segments;i++){
    const a = (i/segments) * Math.PI*2;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return pts;
}


function makeCylinder(r, y0, y1, segments) {
  const positions = [];
  const normals = [];
  const indices = [];
  const circle = createCirclePoints(segments);

  for (let i=0;i<segments;i++){
    const nx = circle[i][0], nz = circle[i][1];
    positions.push(nx*r, y1, nz*r); normals.push(nx,0,nz);
    positions.push(nx*r, y0, nz*r); normals.push(nx,0,nz);
  }
  
  for (let i=0;i<segments;i++){
    const i0 = i*2, i1 = i*2+1, i2 = ((i+1)%segments)*2, i3 = ((i+1)%segments)*2+1;
    indices.push(i0, i1, i2);
    indices.push(i2, i1, i3);
  }
  
  const baseIndex = positions.length/3;
  positions.push(0, y0, 0); normals.push(0,-1,0);
  for (let i=0;i<segments;i++){
    const nx = circle[i][0], nz = circle[i][1];
    positions.push(nx*r, y0, nz*r); normals.push(0,-1,0);
  }
  for (let i=0;i<segments;i++){
    indices.push(baseIndex, baseIndex + 1 + ((i+1)%segments), baseIndex + 1 + i);
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}

function makeHemisphere(r, yCenter, latSegments, lonSegments) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let lat=0; lat<=latSegments; lat++){
    const v = lat / latSegments;
    const theta = v * (Math.PI/2); // from 0 to PI/2
    const sinT = Math.sin(theta), cosT = Math.cos(theta);
    for (let lon=0; lon<=lonSegments; lon++){
      const u = lon / lonSegments;
      const phi = u * (Math.PI*2);
      const x = Math.cos(phi) * cosT;
      const y = Math.sin(theta); // goes 0..1
      const z = Math.sin(phi) * cosT;
      positions.push(x*r, yCenter + y*r, z*r);
      normals.push(x, y, z);
    }
  }
  for (let lat=0; lat<latSegments; lat++){
    for (let lon=0; lon<lonSegments; lon++){
      const a = lat * (lonSegments+1) + lon;
      const b = a + (lonSegments+1);
      indices.push(a, b, a+1);
      indices.push(a+1, b, b+1);
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
}


function mergeMeshes(meshes) {
  let posLen=0, norLen=0, indLen=0;
  for (const m of meshes){ posLen += m.positions.length; norLen += m.normals.length; indLen += m.indices.length; }
  const positions = new Float32Array(posLen);
  const normals = new Float32Array(norLen);
  const indices = new Uint16Array(indLen);
  let posOff=0, norOff=0, indOff=0, vertOffset=0;
  for (const m of meshes){
    positions.set(m.positions, posOff);
    normals.set(m.normals, norOff);
    for (let i=0;i<m.indices.length;i++){
      indices[indOff+i] = vertOffset + m.indices[i];
    }
    posOff += m.positions.length;
    norOff += m.normals.length;
    indOff += m.indices.length;
    vertOffset += m.positions.length/3;
  }
  return {positions, normals, indices};
}

// build ghost: cylinder height 0.8 (from y=0 to y=0.8), hemisphere radius 0.6 on top
const cyl = makeCylinder(0.6, 0.0, 0.6, 28);
const sphere = makeHemisphere(0.6, 0.6, 12, 28);
const ghostMesh = mergeMeshes([cyl, sphere]);

// ----------------------------- create GL buffers -----------------------------
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, ghostMesh.positions, gl.STATIC_DRAW);

const normalBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.bufferData(gl.ARRAY_BUFFER, ghostMesh.normals, gl.STATIC_DRAW);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ghostMesh.indices, gl.STATIC_DRAW);

gl.enableVertexAttribArray(attribs.position);
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);

gl.enableVertexAttribArray(attribs.normal);
gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);

// ----------------------------- scene state -----------------------------
let ghostPos = [0, 0, 0];       
let ghostRotationY = 0;        
let velocity = [0, 0, 0];       
const speed = 2.0;             
const damping = 6.0;           

// keyboard input state
const keys = { ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false };
window.addEventListener('keydown', (e) => {
  if (e.key in keys) { keys[e.key]=true; e.preventDefault(); }
});
window.addEventListener('keyup', (e) => {
  if (e.key in keys) { keys[e.key]=false; e.preventDefault(); }
});

// camera parameters
const camera = {
  eye: [0, 1.2, 3.0],
  center: [0, 0.4, 0],
  up: [0,1,0],
  fov: degToRad(60)
};

// light
const lightDir = [0.5, 1.0, 0.3]; // will normalize
const ldLen = Math.hypot(...lightDir);
lightDir[0]/=ldLen; lightDir[1]/=ldLen; lightDir[2]/=ldLen;

// ----------------------------- animation loop -----------------------------
let lastTime = performance.now();

function updatePhysics(dt) {
  // calculate intended directional input in X-Z plane
  let inputX = 0, inputZ = 0;
  if (keys.ArrowLeft) inputX -= 1;
  if (keys.ArrowRight) inputX += 1;
  if (keys.ArrowUp) inputZ -= 1;    // negative z = forward towards camera center
  if (keys.ArrowDown) inputZ += 1;

  // normalize input vector
  let len = Math.hypot(inputX, inputZ);
  if (len > 0) {
    inputX /= len; inputZ /= len;
  }

  // target velocity based on input
  const targetVX = inputX * speed;
  const targetVZ = inputZ * speed;

  // smooth velocity approach (critically damped-ish)
  velocity[0] += (targetVX - velocity[0]) * Math.min(1, damping * dt);
  velocity[2] += (targetVZ - velocity[2]) * Math.min(1, damping * dt);

  // integrate position
  ghostPos[0] += velocity[0] * dt;
  ghostPos[2] += velocity[2] * dt;

  // update rotation to face movement if moving
  if (Math.hypot(velocity[0], velocity[2]) > 0.01) {
    // angle where 0 deg faces -Z (towards negative Z), positive rotates toward +X
    const angleRad = Math.atan2(velocity[0], -velocity[2]);
    ghostRotationY = angleRad * 180 / Math.PI;
  }

  // optional: clamp within some bounds (a simple play area)
  const bound = 3.0;
  ghostPos[0] = Math.max(-bound, Math.min(bound, ghostPos[0]));
  ghostPos[2] = Math.max(-bound, Math.min(bound, ghostPos[2]));
}

function computeNormalMatrix(modelMatrix) {
  
  return modelMatrix;
}

function drawScene(now) {
  now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000); // clamp dt to avoid huge steps
  lastTime = now;

  updatePhysics(dt);

  resize(); // ensure viewport correct

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.06, 0.06, 0.08, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // projection
  const proj = mat4.create();
  mat4.perspective(proj, camera.fov, canvas.width / canvas.height, 0.1, 100.0);
  gl.uniformMatrix4fv(uniforms.projection, false, proj);

  // view
  const view = mat4.create();
  
  const camEye = [ghostPos[0], camera.eye[1], ghostPos[2] + camera.eye[2]];
  const camCenter = [ghostPos[0], ghostPos[1] + 0.3, ghostPos[2]];
  mat4.lookAt(view, camEye, camCenter, camera.up);
  gl.uniformMatrix4fv(uniforms.view, false, view);

  // model matrix for ghost
  const model = mat4.create();
  mat4.fromTranslationRotationScale(model, [ghostPos[0], ghostPos[1], ghostPos[2]], ghostRotationY, [1,1,1]);
  gl.uniformMatrix4fv(uniforms.model, false, model);

  // normal matrix (simple pass-through here)
  const normalMatrix = computeNormalMatrix(model);
  gl.uniformMatrix4fv(uniforms.normalMatrix, false, normalMatrix);

  // light & material
  gl.uniform3fv(uniforms.lightDir, lightDir);
  gl.uniform3fv(uniforms.color, [0.9, 0.1, 0.9]);   // purple-ish ghost
  gl.uniform3fv(uniforms.ambient, [0.18, 0.18, 0.18]);

  // draw
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.drawElements(gl.TRIANGLES, ghostMesh.indices.length, gl.UNSIGNED_SHORT, 0);

  drawGrid(view, proj);

  requestAnimationFrame(drawScene);
}

function buildGrid() {
  const size = 6, step=0.5;
  const lines = [];
  for (let i = -size; i <= size; i += step) {
    lines.push(-size, 0, i, size, 0, i);
    lines.push(i, 0, -size, i, 0, size);
  }
  const arr = new Float32Array(lines);
  gridBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
}
function drawGrid(view, proj) {
  if (!gridBuffer) buildGrid();
  const model = mat4.create();
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniformMatrix4fv(uniforms.normalMatrix, false, model);
  gl.uniform3fv(uniforms.color, [0.3,0.3,0.3]);
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.disableVertexAttribArray(attribs.normal);
  gl.drawArrays(gl.LINES, 0, (gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE) / Float32Array.BYTES_PER_ELEMENT) / 3);
  gl.enableVertexAttribArray(attribs.normal);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
  gl.vertexAttribPointer(attribs.normal, 3, gl.FLOAT, false, 0, 0);
}

// start
requestAnimationFrame(drawScene);


