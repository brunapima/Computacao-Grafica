// main.js

// =========================================================
// SHADERS ATUALIZADOS (Suporte a Textura OU Cor Sólida)
// =========================================================

const vertexShaderSource = `
    attribute vec3 a_position;
    attribute vec3 a_normal;
    // a_texcoord é opcional agora, dependendo do objeto
    attribute vec2 a_texcoord; 
    
    varying vec3 v_normal;
    varying vec2 v_texcoord;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;
    
    uniform mat4 u_modelViewMatrix;
    uniform mat4 u_viewingMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat4 u_inverseTransposeModelViewMatrix;

    uniform vec3 u_lightPosition;
    uniform vec3 u_viewPosition;

    void main() {
        gl_Position = u_projectionMatrix * u_viewingMatrix * u_modelViewMatrix * vec4(a_position, 1.0);
        v_normal = mat3(u_inverseTransposeModelViewMatrix) * a_normal;
        vec3 surfacePosition = (u_modelViewMatrix * vec4(a_position, 1.0)).xyz;
        
        // Passa a coordenada de textura (pode ser ignorada no fragment shader se não usar textura)
        v_texcoord = a_texcoord;
        
        v_surfaceToLight = u_lightPosition - surfacePosition;
        v_surfaceToView = u_viewPosition - surfacePosition;
    }
`;

const fragmentShaderSource = `
    precision mediump float;

    varying vec3 v_normal;
    varying vec2 v_texcoord;
    varying vec3 v_surfaceToLight;
    varying vec3 v_surfaceToView;

    // NOVOS UNIFORMS PARA CONTROLE DE COR
    uniform sampler2D u_texture;
    uniform bool u_useTexture; // Se verdadeiro, usa textura. Se falso, usa u_color.
    uniform vec4 u_color;      // Cor sólida do objeto

    void main() {
        // Decide a cor base
        vec3 baseColor;
        if (u_useTexture) {
             // Se estiver usando textura, pega a cor da imagem
             vec4 tex = texture2D(u_texture, v_texcoord);
             baseColor = tex.rgb;
        } else {
             // Se não, usa a cor sólida definida (para o personagem)
             baseColor = u_color.rgb;
        }

        // Cálculos de iluminação (Phong básico)
        vec3 normal = normalize(v_normal);
        vec3 lightDir = normalize(v_surfaceToLight);
        vec3 viewDir = normalize(v_surfaceToView);
        vec3 halfVec = normalize(lightDir + viewDir);

        float diffuse = max(dot(lightDir, normal), 0.0);
        float specular = 0.0;
        if (diffuse > 0.0) {
            specular = pow(max(dot(normal, halfVec), 0.0), 50.0);
        }

        vec3 ambient = 0.3 * baseColor;
        vec3 diffuseC = 0.7 * diffuse * baseColor;
        vec3 specularC = specular * vec3(1.0, 1.0, 1.0);

        // Define a cor final
        gl_FragColor = vec4(ambient + diffuseC + specularC, 1.0);
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
    // Pixel temporário enquanto carrega
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([100, 100, 100, 255]));

    const image = new Image();
    image.src = url;
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    return texture;
}

// Funções de geometria do cenário (mantidas)
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

    const program = createProgram(gl, 
        createShader(gl, gl.VERTEX_SHADER, vertexShaderSource), 
        createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
    );
    gl.useProgram(program);

    // --- LOCATIONS (Adicionados useTex e color) ---
    const loc = {
        pos: gl.getAttribLocation(program, 'a_position'),
        norm: gl.getAttribLocation(program, 'a_normal'),
        tex: gl.getAttribLocation(program, 'a_texcoord'),
        mModelView: gl.getUniformLocation(program, 'u_modelViewMatrix'),
        mProj: gl.getUniformLocation(program, 'u_projectionMatrix'),
        mView: gl.getUniformLocation(program, 'u_viewingMatrix'),
        mInvTransp: gl.getUniformLocation(program, 'u_inverseTransposeModelViewMatrix'),
        lightPos: gl.getUniformLocation(program, 'u_lightPosition'),
        viewPos: gl.getUniformLocation(program, 'u_viewPosition'),
        sampler: gl.getUniformLocation(program, 'u_texture'),
        // NOVOS UNIFORMS
        useTex: gl.getUniformLocation(program, 'u_useTexture'),
        color: gl.getUniformLocation(program, 'u_color')
    };

    // --- INICIALIZAÇÃO DO CENA E PERSONAGEM ---
    const texChao = loadTexture(gl, 'ground_texture.jpeg');
    const texParede = loadTexture(gl, 'wall_texture.jpg');

    // Inicializa buffers do personagem (character.js)
    Character.init(gl);

    // Buffers do Cenário
    const buffersCubo = { pos: gl.createBuffer(), norm: gl.createBuffer(), tex: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.pos); gl.bufferData(gl.ARRAY_BUFFER, setCubeVertices(1.0), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.norm); gl.bufferData(gl.ARRAY_BUFFER, setCubeNormals(), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.tex); gl.bufferData(gl.ARRAY_BUFFER, setCubeTexCoords(), gl.STATIC_DRAW);

    const planeSize = 20.0;
    const buffersPlano = { pos: gl.createBuffer(), norm: gl.createBuffer(), tex: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.pos); gl.bufferData(gl.ARRAY_BUFFER, setPlaneVertices(planeSize), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.norm); gl.bufferData(gl.ARRAY_BUFFER, setPlaneNormals(), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.tex); gl.bufferData(gl.ARRAY_BUFFER, setPlaneTexCoords(), gl.STATIC_DRAW);

    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE); 
    gl.clearColor(0.1, 0.1, 0.1, 1.0);

    // =========================================================
    // CONTROLES (Câmera e Personagem)
    // =========================================================
    
    // Estado da Câmera
    let cameraAngle = 0;
    let cameraRadius = 22.0;
    let cameraHeight = 15.0;
    let isDragging = false; let lastMouseX = 0;

    // Estado do Personagem
    let charX = 0.0;
    let charZ = 0.0;
    const charSpeed = 0.15;
    const keysPressed = {}; // Rastreia múltiplas teclas

    // Listeners de Teclado (Movimento)
    window.addEventListener('keydown', (e) => { keysPressed[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { keysPressed[e.key.toLowerCase()] = false; });

    // Listeners de Mouse (Câmera)
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault(); cameraRadius += e.deltaY * 0.02;
        cameraRadius = Math.max(10.0, Math.min(60.0, cameraRadius));
    }, { passive: false });
    canvas.addEventListener('mousedown', (e) => { isDragging = true; lastMouseX = e.clientX; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        cameraAngle += (e.clientX - lastMouseX) * 0.01;
        lastMouseX = e.clientX;
    });

    // Função para atualizar posição do personagem baseado nas teclas
    function updateCharacterMovement() {
        // Movimento no plano XZ
        if (keysPressed['w'] || keysPressed['arrowup']) charZ -= charSpeed;
        if (keysPressed['s'] || keysPressed['arrowdown']) charZ += charSpeed;
        if (keysPressed['a'] || keysPressed['arrowleft']) charX -= charSpeed;
        if (keysPressed['d'] || keysPressed['arrowright']) charX += charSpeed;

        // Limites simples para não sair do chão (mundo é 20x20, de -10 a +10)
        // Deixa uma margem para o tamanho do personagem (aprox 1.0)
        const limit = planeSize / 2 - 1.0;
        charX = Math.max(-limit, Math.min(limit, charX));
        charZ = Math.max(-limit, Math.min(limit, charZ));
    }


    // =========================================================
    // LOOP DE DESENHO
    // =========================================================

    function draw() {
        updateCharacterMovement(); // Atualiza posição antes de desenhar

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Setup Câmera e Luz Global
        let camX = Math.sin(cameraAngle) * cameraRadius;
        let camZ = Math.cos(cameraAngle) * cameraRadius;
        let P0 = [camX, cameraHeight, camZ];
        let Pref = [0, 0, 0];
        let V = [0, 1, 0];
        let viewingMatrix = m4.setViewingMatrix(P0, Pref, V);
        let aspect = gl.canvas.width / gl.canvas.height;
        let projectionMatrix = m4.setPerspectiveProjectionMatrix(-1*aspect, 1*aspect, -1, 1, 1.2, 200.0);

        gl.uniformMatrix4fv(loc.mView, false, viewingMatrix);
        gl.uniformMatrix4fv(loc.mProj, false, projectionMatrix);
        gl.uniform3fv(loc.viewPos, new Float32Array(P0));
        gl.uniform3fv(loc.lightPos, new Float32Array([0.0, 30.0, 10.0])); 

        // --- DESENHAR CHÃO ---
        gl.uniform1i(loc.useTex, 1); // ATIVA TEXTURA
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texChao);
        gl.uniform1i(loc.sampler, 0);
        // (Bind buffers do chão e drawArrays - igual ao anterior)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.norm); gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.norm);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersPlano.tex); gl.vertexAttribPointer(loc.tex, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(loc.tex);
        let floorMatrix = m4.identity();
        gl.uniformMatrix4fv(loc.mModelView, false, floorMatrix);
        gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(floorMatrix)));
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // --- DESENHAR PAREDES ---
        gl.uniform1i(loc.useTex, 1); // ATIVA TEXTURA
        gl.bindTexture(gl.TEXTURE_2D, texParede);
        // (Bind buffers do cubo e loop das paredes - igual ao anterior)
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.norm); gl.vertexAttribPointer(loc.norm, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffersCubo.tex); gl.vertexAttribPointer(loc.tex, 2, gl.FLOAT, false, 0, 0);
        let wallH = 2.0, wallThick = 1.0, offset = planeSize / 2;
        let walls = [ [0, wallH/2, -offset, planeSize, wallH, wallThick], [0, wallH/2, offset, planeSize, wallH, wallThick], [-offset, wallH/2, 0, wallThick, wallH, planeSize], [offset, wallH/2, 0, wallThick, wallH, planeSize] ];
        for(let i=0; i<walls.length; i++) {
            let w = walls[i]; let m = m4.translate(m4.identity(), w[0], w[1], w[2]); m = m4.scale(m, w[3], w[4], w[5]);
            gl.uniformMatrix4fv(loc.mModelView, false, m);
            gl.uniformMatrix4fv(loc.mInvTransp, false, m4.transpose(m4.inverse(m)));
            gl.drawArrays(gl.TRIANGLES, 0, 36);
        }

        // --- DESENHAR PERSONAGEM ---
        // O shader já foi configurado com view/proj. O character.js vai configurar o modelo e a cor.
        // Precisamos desabilitar o atributo de textura pois o personagem não tem
        gl.disableVertexAttribArray(loc.tex);
        
        Character.draw(gl, loc, m4, charX, charZ);
        
        // Reabilita para o próximo frame (cenário)
        gl.enableVertexAttribArray(loc.tex); 

        requestAnimationFrame(draw);
    }
    draw();
}

window.addEventListener('load', main);