// main.js - VERSÃO FINAL (4 Luzes + Correção de Textura)

// =========================================================
// SHADERS ATUALIZADOS (MULTIPLAS LUZES)
// =========================================================

const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    attribute vec2 a_texcoord; 
    
    varying vec3 v_normal;
    varying vec2 v_texcoord;
    // Em vez de calcular a luz aqui, passamos a posição do mundo para o fragment shader
    varying vec3 v_surfacePosition; 
    varying vec3 v_viewPosition;
    
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_viewingMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_inverseTransposeModelViewMatrix;
    uniform vec3 u_viewPosition; // Posição da câmera

    void main() {
        // Posição final na tela
        gl_Position = u_projectionMatrix * u_viewingMatrix * u_modelViewMatrix * vec4(a_position, 1.0);
        
        // Normal transformada
        v_normal = mat3(u_inverseTransposeModelViewMatrix) * a_normal;
        
        // Posição do vértice no mundo real (para cálculo de luz)
        v_surfacePosition = (u_modelViewMatrix * vec4(a_position, 1.0)).xyz;
        
        v_texcoord = a_texcoord;
        v_viewPosition = u_viewPosition;
    }
`;

const fragmentShaderSource = `
    precision mediump float;

    varying vec3 v_normal;
    varying vec2 v_texcoord;
    varying vec3 v_surfacePosition;
    varying vec3 v_viewPosition;

    uniform sampler2D u_texture;
    uniform bool u_useTexture;
    uniform vec4 u_color;

    // Array com as posições das 4 luzes
    uniform vec3 u_lightPositions[4]; 

    void main() {
        vec3 baseColor;
        if (u_useTexture) {
             vec4 tex = texture2D(u_texture, v_texcoord);
             baseColor = tex.rgb;
        } else {
             baseColor = u_color.rgb;
        }

        vec3 normal = normalize(v_normal);
        vec3 viewDir = normalize(v_viewPosition - v_surfacePosition);
        
        // Acumuladores de luz
        vec3 totalDiffuse = vec3(0.0);
        vec3 totalSpecular = vec3(0.0);

        // Loop para calcular as 4 luzes
        for (int i = 0; i < 4; i++) {
            vec3 lightDir = normalize(u_lightPositions[i] - v_surfacePosition);
            vec3 halfVec = normalize(lightDir + viewDir);

            // Diffuse
            float diffuse = max(dot(lightDir, normal), 0.0);
            totalDiffuse += diffuse * vec3(1.0, 1.0, 1.0); // Luz branca

            // Specular
            if (diffuse > 0.0) {
                float specular = pow(max(dot(normal, halfVec), 0.0), 50.0);
                totalSpecular += specular * vec3(1.0, 1.0, 1.0);
            }
        }

        // Luz ambiente base (para não ficar breu total onde as luzes não pegam)
        vec3 ambient = 0.2 * baseColor;
        
        // Soma final: CorBase * (Ambiente + DifusaTotal) + EspecularTotal
        // Multiplicamos por 0.4 na difusa para as 4 luzes não "estourarem" o branco
        vec3 finalColor = ambient + (baseColor * totalDiffuse * 0.4) + (totalSpecular * 0.3);

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// =========================================================
// UTILITÁRIOS
// =========================================================

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    // Pixel temporário azul enquanto carrega
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    
    const image = new Image();
    image.src = url;
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        // MUDANÇA IMPORTANTE: 
        // Para texturas que se repetem (como o chão), usamos gl.REPEAT.
        // Isso corrige o bug do "esticamento" no canto.
        // Nota: A imagem deve ser preferencialmente "Power of 2" (ex: 512x512).
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        } else {
            // Fallback se a imagem não for quadrada perfeita
            console.warn("Imagem não é potência de 2. Usando CLAMP_TO_EDGE (Sem repetição).");
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
    };
    return texture;
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

// ... (Funções de Geometria: setCubeVertices, setCubeNormals, setCubeTexCoords, setPlaneVertices, setPlaneNormals IGUAIS) ...
function setCubeVertices(side) {
    let v = side / 2;
    return new Float32Array([
        v,v,v, v,-v,v, -v,v,v, -v,v,v, v,-v,v, -v,-v,v, // Front
        -v,v,v, -v,-v,v, -v,v,-v, -v,v,-v, -v,-v,v, -v,-v,-v, // Left
        -v,v,-v, -v,-v,-v, v,v,-v, v,v,-v, -v,-v,-v, v,-v,-v, // Back
        v,v,-v, v,-v,-v, v,v,v, v,v,v, v,-v,v, v,-v,-v, // Right
        v,v,v, v,v,-v, -v,v,v, -v,v,v, v,v,-v, -v,v,-v, // Top
        v,-v,v, v,-v,-v, -v,-v,v, -v,-v,v, v,-v,-v, -v,-v,-v, // Bottom
    ]);
}
function setCubeNormals() {
    return new Float32Array([
        0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1, 0,0,1,
        -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0, -1,0,0,
        0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1, 0,0,-1,
        1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0, 1,0,0,
        0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0,
        0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0, 0,-1,0,
    ]);
}
function setCubeTexCoords() {
    return new Float32Array([
        1,0, 1,1, 0,0, 0,0, 1,1, 0,1,
        1,0, 1,1, 0,0, 0,0, 1,1, 0,1,
        1,0, 1,1, 0,0, 0,0, 1,1, 0,1,
        1,0, 1,1, 0,0, 0,0, 1,1, 0,1,
        1,0, 1,1, 0,0, 0,0, 1,1, 0,1,
        1,0, 1,1, 0,0, 0,0, 1,1, 0,1,
    ]);
}
function setPlaneVertices(size) {
    let v = size / 2;
    return new Float32Array([ v,0,-v, -v,0,-v, -v,0,v, v,0,-v, -v,0,v, v,0,v ]);
}
function setPlaneNormals() {
    return new Float32Array([ 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0, 0,1,0 ]);
}
function setPlaneTexCoords() {
    // Como agora usamos gl.REPEAT, podemos colocar números altos aqui (5.0)
    // que a textura vai se repetir 5 vezes sem bugar as bordas.
    let r = 5.0; 
    return new Float32Array([ r,0, 0,0, 0,r, r,0, 0,r, r,r ]);
}

// =========================================================
// MAIN - LÓGICA DO JOGO
// =========================================================

function main() {
    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // ... (Compilação dos Shaders e Locations IGUAIS) ...
    const program = createProgram(gl, 
        createShader(gl, gl.VERTEX_SHADER, vertexShaderSource), 
        createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    );
    gl.useProgram(program);

    const loc = {
        pos: gl.getAttribLocation(program, 'a_position'),
        norm: gl.getAttribLocation(program, 'a_normal'),
        tex: gl.getAttribLocation(program, 'a_texcoord'),
        mModelView: gl.getUniformLocation(program, 'u_modelViewMatrix'),
        mProj: gl.getUniformLocation(program, 'u_projectionMatrix'),
        mView: gl.getUniformLocation(program, 'u_viewingMatrix'),
        mInvTransp: gl.getUniformLocation(program, 'u_inverseTransposeModelViewMatrix'),
        lightPos: gl.getUniformLocation(program, 'u_lightPositions'), // Array
        viewPos: gl.getUniformLocation(program, 'u_viewPosition'),
        sampler: gl.getUniformLocation(program, 'u_texture'),
        useTex: gl.getUniformLocation(program, 'u_useTexture'),
        color: gl.getUniformLocation(program, 'u_color')
    };

    const texChao = loadTexture(gl, 'ground_texture.png');
    const texParede = loadTexture(gl, 'wall_texture.png');

    // Inicializações
    Character.init(gl);
    Ghost.init(gl); // INICIALIZA GEOMETRIA DOS FANTASMAS

    // ... (Buffers do Cubo e Plano IGUAIS) ...
    const buffersCubo = { pos: gl.createBuffer(), norm: gl.createBuffer(), tex: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.pos); gl.bufferData(gl.ARRAY_BUFFER, setCubeVertices(1.0), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.norm); gl.bufferData(gl.ARRAY_BUFFER, setCubeNormals(), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.tex); gl.bufferData(gl.ARRAY_BUFFER, setCubeTexCoords(), gl.STATIC_DRAW);

    // --- CONFIGURAÇÃO DO MAPA ---
    const planeSize = 20.0;
    const mapSize = LevelMap.length; 
    const blockSize = planeSize / mapSize; 
    const mapOffset = planeSize / 2; 

    // SPAWN DOS FANTASMAS (4 fantasmas em posições válidas)
    Ghost.spawn(4);

    const buffersPlano = { pos: gl.createBuffer(), norm: gl.createBuffer(), tex: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.pos); gl.bufferData(gl.ARRAY_BUFFER, setPlaneVertices(planeSize), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.norm); gl.bufferData(gl.ARRAY_BUFFER, setPlaneNormals(), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.tex); gl.bufferData(gl.ARRAY_BUFFER, setPlaneTexCoords(), gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); 
    gl.clearColor(0.0, 0.0, 0.0, 0.0); 

    let cameraAngle = 0;
    let zoom = 32.0; 
    const viewSlope = 1.2; 

    let isDragging = false; 
    let lastMouseX = 0;

    let charX = 0.0;
    let charZ = 0.0;
    const charSpeed = 0.1;
    const keysPressed = {};

    window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });
    
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); 
        zoom += e.deltaY * 0.02;
        zoom = Math.max(15.0, Math.min(60.0, zoom));
    }, { passive: false });

    canvas.addEventListener('mousedown', (e) => { isDragging = true; lastMouseX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        cameraAngle += (e.clientX - lastMouseX) * 0.01;
        lastMouseX = e.clientX;
    });

    function checkCollision(x, z) {
        let col = Math.floor((x + mapOffset) / blockSize);
        let row = Math.floor((z + mapOffset) / blockSize);
        if (row < 0 || row >= mapSize || col < 0 || col >= mapSize) return true;
        return LevelMap[row][col] === 1;
    }

    function updateCharacterMovement() {
        let nextX = charX;
        let nextZ = charZ;
        let r = 0.3; 

        if (keysPressed['w'] || keysPressed['arrowup']) nextZ -= charSpeed;
        if (keysPressed['s'] || keysPressed['arrowdown']) nextZ += charSpeed;
        if (keysPressed['a'] || keysPressed['arrowleft']) nextX -= charSpeed;
        if (keysPressed['d'] || keysPressed['arrowright']) nextX += charSpeed;

        if (!checkCollision(nextX - r, charZ - r) && !checkCollision(nextX + r, charZ - r) &&
            !checkCollision(nextX - r, charZ + r) && !checkCollision(nextX + r, charZ + r)) {
            charX = nextX;
        }
        if (!checkCollision(charX - r, nextZ - r) && !checkCollision(charX + r, nextZ - r) &&
            !checkCollision(charX - r, nextZ + r) && !checkCollision(charX + r, nextZ + r)) {
            charZ = nextZ;
        }
    }

    let lastTime = 0;


    function draw(time) {
        updateCharacterMovement();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // --- CÂMERA ---
        let radius = zoom / Math.sqrt(1 + viewSlope * viewSlope);
        let cameraHeight = radius * viewSlope;
        let camX = Math.sin(cameraAngle) * radius;
        let camZ = Math.cos(cameraAngle) * radius;
        
        let P0 = [camX, cameraHeight, camZ];
        let Pref = [0, 0, 0];
        let V = [0, 1, 0];
        let viewingMatrix = m4.setViewingMatrix(P0, Pref, V);
        
        let aspect = gl.canvas.width / gl.canvas.height;
        let projectionMatrix = m4.setPerspectiveProjectionMatrix(-0.6*aspect, 0.6*aspect, -0.6, 0.6, 1.0, 200.0);

        gl.uniformMatrix4fv(loc.mView, false, viewingMatrix);
        gl.uniformMatrix4fv(loc.mProj, false, projectionMatrix);
        gl.uniform3fv(loc.viewPos, new Float32Array(P0));
        
        // --- LUZES ---
        let lights = [12.0, 15.0, 12.0, -12.0, 15.0, 12.0, 12.0, 15.0, -12.0, -12.0, 15.0, -12.0];
        gl.uniform3fv(loc.lightPos, new Float32Array(lights));

        // --- CHÃO ---
        gl.uniform1i(loc.useTex, 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texChao);
        gl.uniform1i(loc.sampler, 0);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.norm); gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.norm);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.tex); gl.vertexAttribPointer(loc.tex, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.tex);
        
        let floorMatrix = m4.identity();
        gl.uniformMatrix4fv(loc.mModelView, false, floorMatrix);
        gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(floorMatrix)));
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // --- LABIRINTO ---
        gl.uniform1i(loc.useTex, 1);
        gl.bindTexture(gl.TEXTURE_2D, texParede);
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.norm); gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.tex); gl.vertexAttribPointer(loc.tex, 2, gl.FLOAT, false, 0, 0);

        let wallHeight = 1.5;
        for (let row = 0; row < mapSize; row++) {
            for (let col = 0; col < mapSize; col++) {
                if (LevelMap[row][col] === 1) {
                    let posX = (col * blockSize) - mapOffset + (blockSize / 2);
                    let posZ = (row * blockSize) - mapOffset + (blockSize / 2);
                    let m = m4.identity();
                    m = m4.translate(m, posX, wallHeight/2, posZ);
                    m = m4.scale(m, blockSize, wallHeight, blockSize);
                    gl.uniformMatrix4fv(loc.mModelView, false, m);
                    gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(m)));
                    gl.drawArrays(gl.TRIANGLES, 0, 36);
                }
            }
        }

        // --- PERSONAGEM ---
        gl.disableVertexAttribArray(loc.tex);
        Character.draw(gl, loc, m4, charX, charZ);
        
        // --- FANTASMAS (Novo) ---

        let dt = (time - lastTime) / 1000;
        lastTime = time;

        Ghost.update(dt);


        // Desenha os fantasmas estáticos nas posições aleatórias
        Ghost.draw(gl, loc, m4);

        gl.enableVertexAttribArray(loc.tex); 

        requestAnimationFrame(draw);
    }
    draw();
}

window.addEventListener('load', main);