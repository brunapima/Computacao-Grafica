// Direções possíveis de movimento (grid)
const GHOST_DIRS = [
    { x:  1, z:  0 }, // direita
    { x: -1, z:  0 }, // esquerda
    { x:  0, z:  1 }, // frente
    { x:  0, z: -1 }  // trás
];


// function isFreeCell(row, col) {
//     if (row < 0 || row >= mapSize || col < 0 || col >= mapSize)
//         return false;

//     return LevelMap[row][col] === 0;
// };


var Ghost = {
    buffers: {},
    indexCount: 0,
    instances: [], 

    // Lista de coordenadas x,z GARANTIDAS de serem corredores (baseado no pellets.js)
    safeSpawns: [
        { x: 5.5, z: 0.5 }, { x: -5.5, z: 0.5 }, { x: 5.5, z: 4.5 }, 
        { x: -5.5, z: 4.5 }, { x: 2.0, z: 4.5 }, { x: -2.0, z: 4.5 },
        { x: 5.5, z: -6.0 }, { x: -5.5, z: -6.0 }, { x: 9.0, z: 8.5 },
        { x: -9.0, z: 8.5 }, { x: 9.0, z: 4.5 }, { x: -9.0, z: 4.5 },
        { x: 5.5, z: -10.5 }, { x: -5.5, z: -10.5 }, { x: 2.0, z: -10.5 },
        { x: -2.0, z: -10.5 }, { x: 0.0, z: 0.5 }, { x: 0.0, z: -6.0 }
    ],

    init: function(gl) {
        // --- FUNÇÕES AUXILIARES DE GEOMETRIA ---
        function createCirclePoints(segments) {
            const pts = [];
            for (let i=0; i<segments; i++){
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

            // Laterais
            for (let i=0; i<segments; i++){
                const nx = circle[i][0], nz = circle[i][1];
                positions.push(nx*r, y1, nz*r); normals.push(nx,0,nz); 
                positions.push(nx*r, y0, nz*r); normals.push(nx,0,nz); 
            }
            // Indices
            for (let i=0; i<segments; i++){
                const i0 = i*2, i1 = i*2+1, i2 = ((i+1)%segments)*2, i3 = ((i+1)%segments)*2+1;
                indices.push(i0, i1, i2);
                indices.push(i2, i1, i3);
            }
            // Base
            const baseIndex = positions.length/3;
            positions.push(0, y0, 0); normals.push(0,-1,0); 
            for (let i=0; i<segments; i++){
                const nx = circle[i][0], nz = circle[i][1];
                positions.push(nx*r, y0, nz*r); normals.push(0,-1,0);
            }
            for (let i=0; i<segments; i++){
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
                const theta = v * (Math.PI/2); 
                const sinT = Math.sin(theta), cosT = Math.cos(theta);
                for (let lon=0; lon<=lonSegments; lon++){
                    const u = lon / lonSegments;
                    const phi = u * (Math.PI*2);
                    const x = Math.cos(phi) * cosT;
                    const y = Math.sin(theta); 
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

        // --- MALHA ---
        const cyl = makeCylinder(0.5, 0.0, 0.6, 20);
        const sphere = makeHemisphere(0.5, 0.6, 10, 20); 
        const ghostMesh = mergeMeshes([cyl, sphere]);

        this.indexCount = ghostMesh.indices.length;

        this.buffers.pos = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.pos);
        gl.bufferData(gl.ARRAY_BUFFER, ghostMesh.positions, gl.STATIC_DRAW);

        this.buffers.norm = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.norm);
        gl.bufferData(gl.ARRAY_BUFFER, ghostMesh.normals, gl.STATIC_DRAW);

        this.buffers.index = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ghostMesh.indices, gl.STATIC_DRAW);
    },


    spawn: function(count) {
        this.instances = [];
        // Copia a lista de locais seguros para podermos remover os usados (evita sobreposição)
        let available = this.safeSpawns.slice();

        for(let i=0; i<count; i++) {
            if(available.length === 0) break; 

            // Sorteia um índice da lista segura
            let randIndex = Math.floor(Math.random() * available.length);
            let spot = available[randIndex];
            
            // Remove da lista para que outro fantasma não nasça no mesmo lugar
            available.splice(randIndex, 1);

            let color = [Math.random(), Math.random(), Math.random(), 1.0];
            
            // Usa as coordenadas EXATAS
            // this.instances.push({ x: spot.x, z: spot.z, color: color });
            this.instances.push({
                x: spot.x,
                z: spot.z,

                dirX: 1,
                dirZ: 0,

                speed: 0.5,

                // começa sem alvo válido
                targetX: null,
                targetZ: null,

                color: color
            });


        }
    },

    chooseDirection: function(g) { 
        let d = GHOST_DIRS[Math.floor(Math.random() * GHOST_DIRS.length)]; 
        g.dirX = d.x; 
        g.dirZ = d.z; 
        g.targetX = g.x + g.dirX; 
        g.targetZ = g.z + g.dirZ; 
    },


    draw: function(gl, loc, m4) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.pos);
        gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.norm);
        gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0);
        
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.index);

        gl.uniform1i(loc.useTex, 0);

        for (let i = 0; i < this.instances.length; i++) {
            let ghost = this.instances[i];
            
            gl.uniform4fv(loc.color, new Float32Array(ghost.color));

            let m = m4.identity();
            m = m4.translate(m, ghost.x, 0.0, ghost.z); 

            // Escala (Muro=1.5h, 0.95w) -> Fantasma (1.7h, 0.7w)
            // Base original (1.1h, 1.0w)
            let scaleY = 1.7 / 1.1; 
            let scaleXZ = 0.7 / 1.0; 

            m = m4.scale(m, scaleXZ, scaleY, scaleXZ);

            gl.uniformMatrix4fv(loc.mModelView, false, m);
            gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(m)));

            gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
        }
    }
};

Ghost.update = function(dt) {
    for (let g of this.instances) {

        // 🔹 alvo inicial
        if (g.targetX === null || g.targetZ === null) {
            this.chooseDirection(g);
            return;
        }

        let dx = g.targetX - g.x;
        let dz = g.targetZ - g.z;
        let dist = Math.hypot(dx, dz);

        if (dist < 0.01) {
            g.x = g.targetX;
            g.z = g.targetZ;
            this.chooseDirection(g);
            continue;
        }

        let step = g.speed * dt;

        g.x += (dx / dist) * step;
        g.z += (dz / dist) * step;
    }
};


