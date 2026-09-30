(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('cj-loading');

  function startGiftModel(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return false;

    const vertexShader = `attribute vec3 aPosition;attribute vec3 aNormal;attribute vec3 aColor;uniform mat4 uMvp;uniform mat4 uModel;varying vec3 vNormal;varying vec3 vColor;void main(){gl_Position=uMvp*vec4(aPosition,1.0);vNormal=mat3(uModel)*aNormal;vColor=aColor;}`;
    const fragmentShader = `precision mediump float;varying vec3 vNormal;varying vec3 vColor;void main(){vec3 n=normalize(vNormal);vec3 light=normalize(vec3(-0.45,0.8,1.0));float diffuse=max(dot(n,light),0.0);float shade=0.42+diffuse*0.68;gl_FragColor=vec4(vColor*shade,1.0);}`;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return null;
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentShader);
    if (!vs || !fs) return false;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);

    const positions = [], normals = [], colors = [];
    const addBox = (center, size, color) => {
      const [cx, cy, cz] = center, [w, h, d] = size;
      const x=w/2, y=h/2, z=d/2;
      const faces = [
        {n:[0,0,1],v:[[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]]},
        {n:[0,0,-1],v:[[x,-y,-z],[-x,-y,-z],[-x,y,-z],[x,y,-z]]},
        {n:[1,0,0],v:[[x,-y,z],[x,-y,-z],[x,y,-z],[x,y,z]]},
        {n:[-1,0,0],v:[[-x,-y,-z],[-x,-y,z],[-x,y,z],[-x,y,-z]]},
        {n:[0,1,0],v:[[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]]},
        {n:[0,-1,0],v:[[-x,-y,-z],[x,-y,-z],[x,-y,z],[-x,-y,z]]}
      ];
      faces.forEach(face => [0,1,2,0,2,3].forEach(index => {
        positions.push(face.v[index][0]+cx,face.v[index][1]+cy,face.v[index][2]+cz);
        normals.push(...face.n);
        colors.push(...color);
      }));
    };
    const addBowLoop = (centerX) => {
      const segments=32, sides=7, tube=.035, rx=.19, ry=.13, centerY=.73;
      for(let i=0;i<segments;i++) for(let j=0;j<sides;j++) {
        const point=(u,v)=>{
          const t=2*Math.PI*u/segments, a=2*Math.PI*v/sides;
          const nx=Math.cos(t), ny=Math.sin(t);
          return [centerX+rx*nx+tube*Math.cos(a)*nx,centerY+ry*ny+tube*Math.cos(a)*ny,tube*Math.sin(a)];
        };
        const p=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)];
        [[0,1,2],[0,2,3]].forEach(tri=>tri.forEach(k=>{
          const v=p[k]; positions.push(...v);
          const nx=v[0]-centerX, ny=(v[1]-centerY)*.55, nz=v[2];
          const len=Math.hypot(nx,ny,nz)||1; normals.push(nx/len,ny/len,nz/len);
          colors.push(.98,.77,.36);
        }));
      }
    };

    addBox([0,0,0],[1.35,1.02,.96],[.67,.035,.14]);
    addBox([0,.49,0],[1.48,.17,1.08],[.88,.09,.2]);
    addBox([0,.01,0],[.23,1.04,1.005],[.98,.77,.36]);
    addBox([0,.59,0],[1.49,.035,1.085],[.99,.82,.45]);
    addBowLoop(-.16); addBowLoop(.16);
    addBox([0,.74,0],[.15,.12,.15],[1,.84,.48]);

    const bindAttribute = (name, values) => {
      const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);
      const location=gl.getAttribLocation(program,name); gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
    };
    bindAttribute('aPosition',positions); bindAttribute('aNormal',normals); bindAttribute('aColor',colors);
    const uMvp=gl.getUniformLocation(program,'uMvp'), uModel=gl.getUniformLocation(program,'uModel');
    const multiply=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;};
    const perspective=(fov,aspect,near,far)=>{const f=1/Math.tan(fov/2),out=new Float32Array(16);out[0]=f/aspect;out[5]=f;out[10]=(far+near)/(near-far);out[11]=-1;out[14]=(2*far*near)/(near-far);return out;};
    const draw=now=>{
      if(!canvas.isConnected)return;
      const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);
      const angle=reduced?-.55:now*.0016,rx=-.2;
      const model=new Float32Array([Math.cos(angle),0,-Math.sin(angle),0,Math.sin(rx)*Math.sin(angle),Math.cos(rx),Math.sin(rx)*Math.cos(angle),0,Math.cos(rx)*Math.sin(angle),-Math.sin(rx),Math.cos(rx)*Math.cos(angle),0,0,0,-2.9,1]);
      const projection=perspective(Math.PI/4,w/h,.1,100);
      gl.uniformMatrix4fv(uModel,false,model);gl.uniformMatrix4fv(uMvp,false,multiply(projection,model));
      gl.drawArrays(gl.TRIANGLES,0,positions.length/3);
      if(!reduced)requestAnimationFrame(draw);
    };
    draw(performance.now());
    return true;
  }

  function showLoader(leaving = false) {
    let overlay = document.querySelector('.cj-loader');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'cj-loader';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-label', 'Loading CJ Gifts');
      overlay.innerHTML = `<canvas class="loader-gift-canvas" aria-label="A three-dimensional CJ Gifts box rotating"></canvas><div class="loader-gift-fallback" aria-hidden="true">🎁</div><div class="loader-brand"><span>CJ</span> GIFTS</div><div class="loader-caption">A little joy is on its way</div>`;
      document.body.appendChild(overlay);
      if (startGiftModel(overlay.querySelector('.loader-gift-canvas'))) overlay.classList.add('webgl-ready');
    }
    requestAnimationFrame(() => overlay.classList.add('visible'));
    if (leaving) overlay.classList.add('leaving');
    return overlay;
  }

  document.addEventListener('DOMContentLoaded', () => {
    showLoader();
    const started = performance.now();
    const finish = () => setTimeout(() => {
      const overlay = document.querySelector('.cj-loader');
      if (overlay) overlay.classList.add('dismissed');
      document.documentElement.classList.remove('cj-loading');
      setTimeout(() => overlay?.remove(), 700);
    }, Math.max(0, (reduced ? 100 : 900) - (performance.now() - started)));
    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish, { once: true });
  }, { once: true });

  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || reduced || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (anchor.target || anchor.hasAttribute('download') || anchor.getAttribute('href').startsWith('#')) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.href === window.location.href) return;
    event.preventDefault();
    showLoader(true);
    setTimeout(() => { window.location.href = destination.href; }, 280);
  });
})();
