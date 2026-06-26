// J.A.R.V.I.S. Particle Sphere Renderer
(function() {
  const canvas = document.getElementById('sphere-canvas');
  const ctx = canvas.getContext('2d');

  let W, H, cx, cy, radius;
  let particles = [];
  let mode = 'standby'; // standby | talking | alert | research
  let energy = 0;
  let targetEnergy = 0;
  let rotation = 0;

  const PARTICLE_COUNT = 1800;

  function resize() {
    W = canvas.width = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
    cx = W / 2;
    cy = H / 2;
    radius = Math.min(W, H) * 0.28;
  }

  function createParticles() {
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      particles.push({
        theta,
        phi,
        r: radius * (0.85 + Math.random() * 0.18),
        size: Math.random() * 1.8 + 0.4,
        speed: (Math.random() - 0.5) * 0.002,
        phiSpeed: (Math.random() - 0.5) * 0.001,
        alpha: Math.random() * 0.6 + 0.4,
        flicker: Math.random() * Math.PI * 2
      });
    }
  }

  function getColor() {
    switch(mode) {
      case 'alert': return { r: 255, g: 30, b: 60 };
      case 'research': return { r: 130, g: 80, b: 255 };
      case 'gold': return { r: 255, g: 200, b: 50 };
      default: return { r: 0, g: 200, b: 255 };
    }
  }

  function drawSphere(ts) {
    ctx.clearRect(0, 0, W, H);

    energy += (targetEnergy - energy) * 0.05;
    rotation += 0.003 + energy * 0.006;

    const col = getColor();

    // Glow core
    const glowR = radius * (0.55 + energy * 0.2);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
    gradient.addColorStop(0, `rgba(${col.r},${col.g},${col.b},${0.08 + energy * 0.08})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
    ctx.fill();

    // Particles
    for (let p of particles) {
      p.theta += p.speed + rotation * 0.01;
      p.phi += p.phiSpeed;
      p.flicker += 0.05;

      const r = p.r + Math.sin(p.flicker) * 4 * energy;
      const sinPhi = Math.sin(p.phi);
      const x = cx + r * sinPhi * Math.cos(p.theta);
      const y = cy + r * Math.cos(p.phi);
      const z = r * sinPhi * Math.sin(p.theta); // depth
      const depth = (z / radius + 1) / 2; // 0..1

      const alpha = (p.alpha * depth * 0.7 + 0.15) * (1 + energy * 0.4);
      const size = p.size * (0.5 + depth * 0.8) * (1 + energy * 0.3);

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col.r},${col.g},${col.b},${Math.min(alpha, 1)})`;
      ctx.fill();
    }

    // HUD ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},${0.15 + energy * 0.3})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 12]);
    ctx.lineDashOffset = -ts * 0.05;
    ctx.stroke();
    ctx.setLineDash([]);

    // Second ring (counter-rotating)
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${col.r},${col.g},${col.b},0.07)`;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 20]);
    ctx.lineDashOffset = ts * 0.03;
    ctx.stroke();
    ctx.setLineDash([]);

    requestAnimationFrame(drawSphere);
  }

  // Public API
  window.Sphere = {
    setMode(m) {
      mode = m;
    },
    setEnergy(e) {
      targetEnergy = Math.max(0, Math.min(1, e));
    },
    pulse() {
      targetEnergy = 1;
      setTimeout(() => { targetEnergy = 0.2; }, 800);
    }
  };

  window.addEventListener('resize', () => { resize(); });
  resize();
  createParticles();
  requestAnimationFrame(drawSphere);
})();
