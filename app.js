
/**
 * ARCHITECTURAL CONFIGURATION
 */
const CONFIG = {
    GRAVITY: 0.25,
    JUMP_STRENGTH: -4.8,
    PIPE_SPEED: 2.8,
    PIPE_SPAWN_RATE: 1400,
    PIPE_GAP: 155,
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 600,
    BIRD_RADIUS: 14
};

/**
 * MATH UTILITIES
 */
const Utils = {
    randomRange: (min, max) => Math.random() * (max - min) + min,
    clamp: (val, min, max) => Math.min(Math.max(val, min), max)
};

/**
 * AI AGENT (Decision Making)
 */
class AI {
    think(bird, nextPipe) {
        if (!nextPipe) return false;
        // Simple logic: maintain Y position relative to the gap center
        const targetY = nextPipe.topHeight + (CONFIG.PIPE_GAP * 0.65);
        return bird.y > targetY;
    }
}

/**
 * BIRD ENTITY
 */
class Bird {
    constructor() {
        this.ai = new AI();
        this.reset();
    }

    reset() {
        this.x = 80;
        this.y = CONFIG.CANVAS_HEIGHT / 2;
        this.velocity = 0;
        this.radius = CONFIG.BIRD_RADIUS;
        this.isDead = false;
        this.isWaiting = true; // NEW: The bird starts in a waiting/hovering state
        this.rotation = 0;
        this.hoverTicks = 0;
    }

    jump() {
        this.velocity = CONFIG.JUMP_STRENGTH;
        if (this.isWaiting) {
            this.isWaiting = false;
            document.getElementById('readyScreen').classList.add('hidden');
        }
    }

    update(dt, useAI, nextPipe) {
        if (this.isWaiting) {
            // Hover animation logic
            this.hoverTicks += 0.05;
            this.y = (CONFIG.CANVAS_HEIGHT / 2) + Math.sin(this.hoverTicks) * 15;
            this.rotation = 0;

            // If AI is on, start automatically
            if (useAI) this.jump();
            return;
        }

        if (useAI && this.ai.think(this, nextPipe)) {
            this.jump();
        }

        this.velocity += CONFIG.GRAVITY;
        this.y += this.velocity;
        this.rotation = Math.min(Math.PI / 3, Math.max(-Math.PI / 6, (this.velocity / 12)));

        if (this.y + this.radius > CONFIG.CANVAS_HEIGHT || this.y - this.radius < 0) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Body Drawing
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Eye Drawing
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(8, -5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(10, -5, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Wing Drawing
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.ellipse(-6, 2, 9, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

/**
 * OBSTACLE ENTITY
 */
class Pipe {
    constructor(x) {
        this.x = x;
        this.width = 65;
        this.passed = false;
        this.topHeight = Utils.randomRange(80, CONFIG.CANVAS_HEIGHT - CONFIG.PIPE_GAP - 80);
    }

    update() {
        this.x -= CONFIG.PIPE_SPEED;
    }

    draw(ctx) {
        ctx.fillStyle = '#2ecc71';
        ctx.strokeStyle = '#27ae60';
        ctx.lineWidth = 4;

        // Top Pipe
        ctx.fillRect(this.x, 0, this.width, this.topHeight);
        ctx.strokeRect(this.x, -5, this.width, this.topHeight + 5);

        // Bottom Pipe
        const bY = this.topHeight + CONFIG.PIPE_GAP;
        const bH = CONFIG.CANVAS_HEIGHT - bY;
        ctx.fillRect(this.x, bY, this.width, bH);
        ctx.strokeRect(this.x, bY, this.width, bH + 5);

        // Caps
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(this.x - 4, this.topHeight - 25, this.width + 8, 25);
        ctx.strokeRect(this.x - 4, this.topHeight - 25, this.width + 8, 25);
        ctx.fillRect(this.x - 4, bY, this.width + 8, 25);
        ctx.strokeRect(this.x - 4, bY, this.width + 8, 25);
    }

    collidesWith(bird) {
        if (bird.x + bird.radius - 4 > this.x && bird.x - bird.radius + 4 < this.x + this.width) {
            if (bird.y - bird.radius + 4 < this.topHeight || bird.y + bird.radius - 4 > this.topHeight + CONFIG.PIPE_GAP) {
                return true;
            }
        }
        return false;
    }
}

/**
 * GAME ENGINE
 */
class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.CANVAS_WIDTH;
        this.canvas.height = CONFIG.CANVAS_HEIGHT;

        this.bird = new Bird();
        this.pipes = [];
        this.score = 0;
        this.highScore = localStorage.getItem('flappyHighScore') || 0;
        this.state = 'MENU'; 
        this.isAIMode = false;
        this.lastTime = 0;
        this.spawnTimer = 0;

        this.initListeners();
        this.updateHUD();
        this.loop(0);
    }

    initListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.handleInput();
            if (e.code === 'KeyA') this.toggleAI();
        });
        this.canvas.addEventListener('mousedown', () => this.handleInput());
    }

    toggleAI() {
        this.isAIMode = !this.isAIMode;
        document.getElementById('aiIndicator').classList.toggle('hidden', !this.isAIMode);
    }

    handleInput() {
        if (this.state === 'PLAYING') {
            this.bird.jump();
        } else if (this.state === 'MENU') {
            this.start();
        }
    }

    start() {
        this.bird.reset();
        this.pipes = [];
        this.score = 0;
        this.state = 'PLAYING';
        this.updateHUD();
        document.getElementById('startMenu').classList.add('hidden');
        document.getElementById('gameOverMenu').classList.add('hidden');
        document.getElementById('readyScreen').classList.remove('hidden');
    }

    gameOver() {
        this.state = 'GAMEOVER';
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('flappyHighScore', this.highScore);
        }
        document.getElementById('gameOverMenu').classList.remove('hidden');
        document.getElementById('finalScore').innerText = `Score: ${this.score}`;
    }

    restart() { this.start(); }

    updateHUD() {
        document.getElementById('scoreDisplay').innerText = this.score;
        document.getElementById('highScoreDisplay').innerText = `BEST: ${this.highScore}`;
    }

    update(dt) {
        if (this.state !== 'PLAYING') return;

        const nextPipe = this.pipes.find(p => p.x + p.width > this.bird.x - this.bird.radius);
        this.bird.update(dt, this.isAIMode, nextPipe);

        if (this.bird.isDead) return this.gameOver();
        
        // Only spawn and move pipes if bird has started moving (physics active)
        if (!this.bird.isWaiting) {
            this.spawnTimer += dt;
            if (this.spawnTimer > CONFIG.PIPE_SPAWN_RATE) {
                this.pipes.push(new Pipe(CONFIG.CANVAS_WIDTH));
                this.spawnTimer = 0;
            }

            for (let i = this.pipes.length - 1; i >= 0; i--) {
                const pipe = this.pipes[i];
                pipe.update();
                if (pipe.collidesWith(this.bird)) this.gameOver();
                if (!pipe.passed && pipe.x + pipe.width < this.bird.x) {
                    pipe.passed = true;
                    this.score++;
                    this.updateHUD();
                }
                if (pipe.x + pipe.width < 0) this.pipes.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#70c5ce');
        gradient.addColorStop(1, '#4eb3be');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0,0,this.canvas.width, this.canvas.height);

        this.pipes.forEach(pipe => pipe.draw(this.ctx));
        this.bird.draw(this.ctx);

        // Ground Layer
        this.ctx.fillStyle = '#ded895';
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - 40, CONFIG.CANVAS_WIDTH, 40);
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(0, CONFIG.CANVAS_HEIGHT - 40, CONFIG.CANVAS_WIDTH, 4);
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }
}

const game = new GameEngine();
