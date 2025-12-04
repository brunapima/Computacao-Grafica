// character.js - VERSÃO CORRIGIDA (Proporções e Movimento Sólido)

var Character = {
    buffers: {},
    sphereCount: 0,

    // Cores base
    colors: {
        skin: [0.9, 0.7, 0.6, 1.0],  // Pele
        shirt: [0.8, 0.1, 0.1, 1.0], // Camisa Vermelha
        pants: [0.1, 0.3, 0.7, 1.0]  // Calça Azul
    },

    init: function(gl) {
        // --- GEOMETRIA (Cubo e Esfera) ---
        const setCubeVerts = (side) => {
            let v = side / 2;
            return new Float32Array([
                v,v,v, v,-v,v, -v,v,v, -v,v,v, v,-v,v, -v,-v,v, // Front
                -v,v,v, -v,-v,v, -v,v,-v, -v,v,-v, -v,-v,v, -v,-v,-v, // Left
                -v,v,-v, -v,-v,-v, v,v,-v, v,v,-v, -v,-v,-v, v,-v,-v, // Back
                v,v,-v, v,-v,-v, v,v,v, v,v,v, v,-v,v, v,-v,-v, // Right
                v,v,v, v,v,-v, -v,v,v, -v,v,v, v,v,-v, -v,v,-v, // Top
                v,-v,v, v,-v,-v, -v,-v,v, -v,-v,v, v,-v,-v, -v,-v,-v, // Bottom
            ]);
        };
        const setCubeNorms = () => {
             return new Float32Array([
                0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1,
                -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0,
                0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
                1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0,
                0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0,
                0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
            ]);
        };

        const createSphere = (radius, bands) => {
            let positions = []; let normals = []; let indices = [];
            for (let lat = 0; lat <= bands; lat++) {
                let theta = lat * Math.PI / bands;
                let sinTheta = Math.sin(theta); let cosTheta = Math.cos(theta);
                for (let lon = 0; lon <= bands; lon++) {
                    let phi = lon * 2 * Math.PI / bands;
                    let x = Math.cos(phi) * sinTheta; let y = cosTheta; let z = Math.sin(phi) * sinTheta;
                    positions.push(radius * x, radius * y, radius * z); normals.push(x, y, z);
                }
            }
            for (let lat = 0; lat < bands; lat++) {
                for (let lon = 0; lon < bands; lon++) {
                    let first = (lat * (bands + 1)) + lon; let second = first + bands + 1;
                    indices.push(first, second, first + 1); indices.push(second, second + 1, first + 1);
                }
            }
            return { pos: new Float32Array(positions), norm: new Float32Array(normals), indices: new Uint16Array(indices) };
        };

        // Inicializa Buffers
        this.buffers.cubePos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.cubePos); gl.bufferData(gl.ARRAY_BUFFER, setCubeVerts(1.0), gl.STATIC_DRAW);
        this.buffers.cubeNorm = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.cubeNorm); gl.bufferData(gl.ARRAY_BUFFER, setCubeNorms(), gl.STATIC_DRAW);

        // Raio da esfera base é 0.5 para facilitar contas (diâmetro 1.0)
        let sphereData = createSphere(0.5, 24); 
        this.sphereCount = sphereData.indices.length;
        this.buffers.spherePos = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.spherePos); gl.bufferData(gl.ARRAY_BUFFER, sphereData.pos, gl.STATIC_DRAW);
        this.buffers.sphereNorm = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.sphereNorm); gl.bufferData(gl.ARRAY_BUFFER, sphereData.norm, gl.STATIC_DRAW);
        this.buffers.sphereIndex = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.sphereIndex); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereData.indices, gl.STATIC_DRAW);
    },

    draw: function(gl, loc, m4, charPosX, charPosZ) {
        gl.uniform1i(loc.useTex, 0); // Garante que não usa textura

        let baseY = 0.0;

        // --- DEFINIÇÃO DE DIMENSÕES E POSIÇÕES ---
        // Pernas
        let legW = 0.5, legH = 1.2, legD = 0.5;
        let legOffsetY = legH / 2.0; // Centro Y da perna
        let legOffsetX = 0.3;        // Afastamento do centro em X

        // Tronco (Senta exatamente em cima das pernas)
        let torsoW = 1.2, torsoH = 1.5, torsoD = 0.6;
        let torsoBaseY = legH;
        let torsoOffsetY = torsoBaseY + (torsoH / 2.0); // Centro Y do tronco

        // Braços (Ao lado do tronco, alinhados pelo topo)
        let armW = 0.4, armH = 1.3, armD = 0.4;
        let armOffsetX = (torsoW / 2.0) + (armW / 2.0); // Logo ao lado do tronco
        let armOffsetY = (torsoBaseY + torsoH) - (armH / 2.0); // Alinha o topo do braço com o topo do tronco

        // Cabeça (Esfera)
        let headScale = 0.9; // Escala da esfera base (que tem diametro 1.0)
        let headBaseY = torsoBaseY + torsoH;
        // Centro da esfera = base + raio + um pequeno pescoço (0.05)
        let headOffsetY = headBaseY + (headScale / 2.0) + 0.05;

        // --- HELPER: Desenha Parte Cúbica ---
        let drawCubePart = (w, h, d, offX, offY, offZ, color) => {
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.cubePos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.cubeNorm); gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0);
            gl.uniform4fv(loc.color, new Float32Array(color));

            let m = m4.identity();
            // 1. Aplica a posição GLOBAL do personagem (Garante que tudo se move junto)
            m = m4.translate(m, charPosX, baseY, charPosZ);
            // 2. Aplica o offset LOCAL da parte do corpo
            m = m4.translate(m, offX, offY, offZ);
            // 3. Aplica a escala da parte
            m = m4.scale(m, w, h, d);

            gl.uniformMatrix4fv(loc.mModelView, false, m);
            gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(m)));
            gl.drawArrays(gl.TRIANGLES, 0, 36);
        };

        // --- HELPER: Desenha Cabeça (Esfera) ---
        let drawHeadPart = (scale, offX, offY, offZ) => {
             gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.spherePos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
             gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.sphereNorm); gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0);
             gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffers.sphereIndex);
             gl.uniform4fv(loc.color, new Float32Array(this.colors.skin));

             let m = m4.identity();
             // 1. Posição Global
             m = m4.translate(m, charPosX, baseY, charPosZ);
             // 2. Offset Local
             m = m4.translate(m, offX, offY, offZ);
             // 3. Escala uniforme
             m = m4.scale(m, scale, scale, scale);
             
             gl.uniformMatrix4fv(loc.mModelView, false, m);
             gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(m)));
             gl.drawElements(gl.TRIANGLES, this.sphereCount, gl.UNSIGNED_SHORT, 0);
        }

        // --- MONTAGEM ---
        // Pernas (Calça Azul)
        drawCubePart(legW, legH, legD, -legOffsetX, legOffsetY, 0, this.colors.pants); // Esq
        drawCubePart(legW, legH, legD,  legOffsetX, legOffsetY, 0, this.colors.pants); // Dir

        // Tronco (Camisa Vermelha)
        drawCubePart(torsoW, torsoH, torsoD, 0, torsoOffsetY, 0, this.colors.shirt);

        // Braços (Camisa Vermelha)
        drawCubePart(armW, armH, armD, -armOffsetX, armOffsetY, 0, this.colors.shirt); // Esq
        drawCubePart(armW, armH, armD,  armOffsetX, armOffsetY, 0, this.colors.shirt); // Dir

        // Cabeça (Pele)
        drawHeadPart(headScale, 0, headOffsetY, 0);
    }
};