window.background = "#1c1b22";
window.foreground = "#f6f6f6";

// canvas size (px)
const width = 300;
const height = 200;
const zoom = 1; //window.innerWidth >= width * 4 ? 4 : 2;
const circleSize = Math.floor(width/50);

// Figure out if the foreground text should be light
// or dark for palette
// https://stackoverflow.com/a/11868398
function getContrastYIQ(r, g, b){
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

// Things we should do at the beginning of every draw call, for all steps
function before(p) {
    p.background(p.backgroundColor || window.background);
}

function make(id, width, height, zoom, fn, webgl = false) {
    return new p5((p) => {
        p.isWEBGL = webgl;
        p.swatchBarSpacer = null;
        p.backgroundColor = p.color(window.background);

        // Things we should do at the beginning of every draw call, for all steps
        p.before = () => before(p);

        p.rendering = true;
        p.resume = () => {
            p.loop();
            p.rendering = true;
        }
        p.pause = () => {
            p.noLoop();
            p.rendering = false;
        }

        p.onToggle = (elt) => {
            p.toggleRendering();
            elt.textContent = `${p.rendering ? "Pause" : "Resume"} Rendering`;
        };
        p.toggleRendering = () => {
            if (p.rendering) {
                p.pause();
            } else {
                p.resume();
            }
        }
        p.addToggleRenderingButton = () =>
            p.addButton("Start Rendering", p.backgroundColor, p.onToggle, {'margin-right': '10px'});

        p.ensureSwatchBarSpacer = () => {
            if (p.swatchBarSpacer) {
                return;
            }
            p.swatchBarSpacer = p.createDiv();
        }

        p.addParticleSwatch = (particleType, onClick) =>
            p.addButton(particleType.nickname ?? particleType.name, particleType.baseColor, onClick);

        p.addButton = (text, color, onClick, styles = {}) => {
            p.ensureSwatchBarSpacer();
            let div = p.createButton(text);
            div.style('background-color', color);
            div.style('padding', '7px');
            div.style('height', '32px');
            div.style('cursor', 'pointer');
            div.style('border', `2px solid #2b2b2b`);
            div.style('margin-top', `4px`);
            const c = p.color(color);
            div.style(
                'color', getContrastYIQ(p.red(c), p.green(c), p.blue(c))
            );
            for (let k in styles) {
                div.style(k, styles[k]);
            }
            div.elt.onclick = () => onClick(div.elt);
            return div;
        };

        p.canvas = null;
        p.zoom = zoom;

        p.calculateZoom = () => zoom;
        p.setZoom = (zoom) => {
            p.zoom = zoom;
            if (p.canvas) {
                p.canvas.elt.style.width = `${p.canvas.width * zoom}px`;
                p.canvas.elt.style.height = `${p.canvas.height * zoom}px`;
            }
        }

        p.setup_ = () => {};
        p.setup = function () {
            // Disable context menu
            for (let element of document.getElementsByClassName("p5Canvas")) {
                element.addEventListener("contextmenu", (e) => e.preventDefault());
                element.addEventListener("touchstart", (e) => e.preventDefault());
                element.addEventListener("touchend", (e) => e.preventDefault());
                element.addEventListener("touchmove", (e) => e.preventDefault());
            }

            // 60 FPS
            p.frameRate(60);

            // Ignore pixel density (Hi-DPI)
            p.pixelDensity(1);

            // Zoom canvas
            const canvas = p.createCanvas(width, height, p.isWEBGL ? p.WEBGL : p.P2D);
            p.canvas = canvas;
            p.setZoom(zoom);

            p.background(p.backgroundColor);
            p.setup_(canvas);
            p.loadPixels();
            p.noCursor();

            if (!p.rendering) {
                p.noLoop();
            }
        };

        p.draw_ = () => {};
        p.update = () => {};
        p.after = () => {};

        p.onLeftClick = (x, y) => {};
        p.onRightClick = (x, y) => {};

        // Allow scheduling functions for after next update
        p._postUpdateQueue = [];
        p.schedulePostUpdate = (fn) => {
            p._postUpdateQueue.push(fn);
        }

        p.draw = function () {
            (p.before || (() => before(p)))();
            p.update();

            p._postUpdateQueue.forEach((fn) => {
                fn();
            })
            p._postUpdateQueue = [];

            if (p.mouseActivated()) {
                if ((p.touches.length && p.touches.length < 2) || p.mouseButton === p.LEFT) {
                    p.onLeftClick(p.getMousePixelX(), p.getMousePixelY());
                } else {
                    p.onRightClick(p.getMousePixelX(), p.getMousePixelY());
                }
            }
            p.draw_();

            p.drawMouse();
            p.after();
        };

        p.mouseXInBounds = () => p.mouseX > 0 && p.mouseX < p.width - 1;
        p.mouseYInBounds = () => p.mouseY > 0 && p.mouseY < p.height - 1;
        p.mouseInBounds = () => p.mouseXInBounds() && p.mouseYInBounds();

        p.mouseActivated = () => (p.mouseIsPressed) && p.mouseInBounds();

        p.getMouseX = () => p.isWEBGL ? p.mouseX - p.width / 2 : p.constrain(p.mouseX, 0, p.width - 1);
        p.getMouseY = () => p.isWEBGL ? p.mouseY - p.height / 2 : p.constrain(p.mouseY, 0, p.height - 1);
        p.getMousePixelX = () => p.floor(p.getMouseX());
        p.getMousePixelY = () => p.floor(p.getMouseY());

        p.drawMouse = () => p.drawMouseCircle(2, "#fff");

        p.drawMouseCircle = (radius, color) => {
            if (p.mouseInBounds()) {
                p.fill(color);
                if (color !== Empty.baseColor) {
                    p.noStroke();
                } else {
                    p.stroke("#fff");
                }
                p.circle(p.getMousePixelX(), p.getMousePixelY(), 2 * radius);
                p.noStroke();
            }
        }

        p.registerMaterials = (materials, fn) => {
            materials.forEach((material) => {
                p.addParticleSwatch(material, () => fn(material));
            });
        }

        p.addClearButton = (clear) => {
            p.addButton("Clear All", p.backgroundColor, clear);
        }

        // Draw a pixel - don't forget to update when done!
        p.setPixel = (i, color) => {
            const index = 4 * i;
            p.pixels[index] = p.red(color);
            p.pixels[index + 1] = p.green(color);
            p.pixels[index + 2] = p.blue(color);
            p.pixels[index + 3] = p.alpha(color);
        };

        p.clearPixels = () => {
            for (let i = 0; i < p.pixels.length / 4; i ++) {
                p.setPixel(i, p.backgroundColor);
            }
        }

        // Add some lightness variation to the color
        p.varyColor = (color, options = {satFn: () => p.random(-20, 0), lightFn: () => p.random(-10, 10)}) => {
            let hue = p.floor(p.hue(color));
            let saturation = p.constrain(p.saturation(color) + p.floor(options.satFn()), 0, 100);
            let lightness = p.constrain(p.lightness(color) + p.floor(options.lightFn()), 0, 100);
            return p.color(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
        };

        if (fn) {
            fn(p);
        }

        p.windowResized = () => {
            p.setZoom(p.calculateZoom());
        };

    }, id);
}

function choose(array, weights) {
    if (array.length !== weights.length) {
        throw new Error("Array and weights must be the same length");
    }
    const sum = weights.reduce((sum, a) => sum + a, 0);
    const normalized = weights.map((w) => w / sum);
    const random = Math.random();
    for (let i = 0; i < array.length; i++) {
        if (random < normalized[i]) {
            return array[random];
        }
    }
    return array[array.length - 1];
}

function makeLogic(logic, mapType) {
    return (p) => {
        new logic().logic(p, new mapType());
    }
}

// define particles
class Particle {
    constructor({color, empty} = {}) {
        this.color = color;
        this.empty = empty ?? false;
    }
    update() {}
  }

class Sand extends Particle {
    static baseColor = "#dcb159";
    constructor(p) {
        super({color: p.varyColor(Sand.baseColor)});
        this.maxSpeed = 8;
        this.acceleration = 0.4;
        this.velocity = 0;
        this.modified = false;
    }

    resetVelocity() {
        this.velocity = 0;
    }

    updateVelocity() {
        let newVelocity = this.velocity + this.acceleration;

        if (Math.abs(newVelocity) > this.maxSpeed) {
            newVelocity = Math.sign(newVelocity) * this.maxSpeed;
        }

        this.velocity = newVelocity;
        }

        update() {
        if ((this.maxSpeed ?? 0) === 0) {
            this.modified = false;
            return;
        }
        this.updateVelocity();
        this.modified = this.velocity !== 0;
        }

        getUpdateCount() {
        const abs = Math.abs(this.velocity);
        const floored = Math.floor(abs);
        const mod = abs - floored;
        // Treat a remainder (e.g. 0.5) as a random chance to update
        return floored + (Math.random() < mod ? 1 : 0);
    }

}

class Wood extends Particle {
    static baseColor = "#46281d";
    static addProbability = 0.5;
    constructor(p) {
        super({color: p.varyColor(Wood.baseColor)});
    }
}


class Empty extends Particle {
    static baseColor = window.background;
    constructor() {
        super({empty: true});
    }
}

// define grid behavior and p5 draw logic
class Logic {
    currentParticleType = Sand;
    availableMaterials = [Sand, Wood, Empty];

    logic(p, grid) {
        p.rendering = true;
        p.calculateZoom = () => window.innerWidth - 40 >= width * 4 ? 4 : 2;

        p.setup_ = () => {
            p.registerMaterials(this.availableMaterials, (material) => this.currentParticleType = material);
            p.addClearButton(() => {
                grid.clear();
                p.draw_();
            });
            grid.initialize(p.width, p.height);
            p.drawCircle(20, 20);
        }
        p.onLeftClick = (x, y) => {
            grid.setCircle(
                x,
                y,
                () => new this.currentParticleType(p),
                circleSize,
                this.currentParticleType.addProbability,
            );
        };
        p.onRightClick = () => grid.clear();

        p.drawCircle = (x, y) => {
            grid.setCircle(
                x, y, () => new this.currentParticleType(p), circleSize, this.currentParticleType.addProbability
            );
        }
        p.drawMouse = () => p.drawMouseCircle(circleSize, this.currentParticleType.baseColor);
        p.draw_ = () => grid.draw(p);
        p.update = () => grid.update();

        p.mouseDragged = () => {p.resume();}
        p.mouseMoved = () => {p.resume();}
        p.mousePressed = () => {p.resume();}
        p.touched = () => {p.resume();}
        p.after = () => {
            if (!grid.needsUpdate()) {
                p.pause();
            }
        }
    }
}

class Grid {
    initialize(width, height) {
        this.width = width;
        this.height = height;
        this.clear();

        this.modifiedIndices = new Set();
        this.cleared = false;
        this.rowCount = Math.floor(this.grid.length / this.width);
    }

    index(x, y) {
        return y * this.width + x;
    }

    setIndex(i, particle) {
        this.grid[i] = particle;
        this.modifiedIndices.add(i);
    }

    set(x, y, particle) {
        const index = this.index(x, y);
        if (x < 0 || x >= this.width) return -1;
        if (y < 0 || y >= this.height) return -1;
        this.setIndex(index, particle);
    }
    
    clear() {
        this.grid = new Array(this.width * this.height).fill(0).map(() => new Empty());
        this.cleared = true;
    }

    clearIndex(i) {
        this.setIndex(i, new Empty());
    }
    
    swap(a, b) {
        if (this.grid[a].empty && this.grid[b].empty) {
            return;
        }
        const temp = this.grid[a];
        this.grid[a] = this.grid[b];
        this.setIndex(a, this.grid[b]);
        this.setIndex(b, temp);
    }

    isEmpty(index) {
        return this.grid[index]?.empty ?? false;
    }

    setCircle(x, y, createParticle, radius = 2, probability = 1.0) {
        let radiusSq = radius * radius;
        for(let y1 = -radius; y1 <= radius; y1++) {
            for (let x1 = -radius; x1 <= radius; x1++) {
            if (x1 * x1 + y1 * y1 <= radiusSq && Math.random() < probability) {
                this.set(x + x1, y + y1, createParticle());
            }
            }
        }
    }

    needsUpdate() {
        return this.cleared || this.modifiedIndices.size;
    }
    
    update() {
        this.cleared = false;
        this.modifiedIndices.clear();
        for (let i = this.grid.length - this.width - 1; i > 0; i--) {
            this.updatePixel(i);
        }
    }


    updatePixel(i) {
        const below = i + this.width;
        const belowLeft = below - 1;
        const belowRight = below + 1;
        const column = i % this.width;
  
        if (this.isEmpty(below)) {
            this.swap(i, below);
            return below;
        // Check to make sure belowLeft didn't wrap to the next line
        } else if (this.isEmpty(belowLeft) && belowLeft % this.width < column) {
            this.swap(i, belowLeft);
            return belowLeft;
        // Check to make sure belowRight didn't wrap to the next line
        } else if (this.isEmpty(belowRight) && belowRight % this.width > column) {
            this.swap(i, belowRight);
            return belowRight;
        }
  
        return i;
    }

    update() {
        this.cleared = false;
        this.modifiedIndices = new Set();

        for (let row = this.rowCount - 1; row >= 0; row--) {
            const rowOffset = row * this.width;
            const leftToRight = Math.random() > 0.5;
            for (let i = 0; i < this.width; i++) {
                // Go from right to left or left to right depending on our random value
                const columnOffset = leftToRight ? i : -i - 1 + this.width;
                let index = rowOffset + columnOffset;

                if (this.isEmpty(index)) {continue;}
                const particle = this.grid[index];

                particle.update();

                // If the particle will be modified, mark it as such.
                // This is needed as fractional (probabilistic) movement
                // will not otherwise be tracked.
                if (!particle.modified) {
                    // If it wasn't modified, just continue in the loop
                    continue;
                }

                // Update the number of times the particle instructs us to
                for (let v = 0; v < particle.getUpdateCount(); v++) {
                    const newIndex = this.updatePixel(index);

                    // If we swapped the particle to a new location,
                    // we need to update our index to be that new one.
                    // As we are repeatedly updating the same particle.
                    if (newIndex !== index) {
                        this.modifiedIndices.add(index);
                        this.modifiedIndices.add(newIndex);
                        index = newIndex;
                    } else {
                        particle.resetVelocity();
                    break;
                    }
                }
            }
        }
    }

    draw(p) {
        if (this.cleared) {
            p.clearPixels();
        } else if (this.modifiedIndices.size) {
            this.modifiedIndices.forEach((index) => {
                p.setPixel(index, this.grid[index].color || p.backgroundColor);
            });
        }
        p.updatePixels();
    }
}

make('sand', width, height, zoom, makeLogic(Logic, Grid));