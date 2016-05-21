function $(e) {
    return document.querySelectorAll(e)[0];
}
function getRandomByte() {
    return Math.floor(Math.random() * 256);
}
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0:
            r = v, g = t, b = p;
            break;
        case 1:
            r = q, g = v, b = p;
            break;
        case 2:
            r = p, g = v, b = t;
            break;
        case 3:
            r = p, g = q, b = v;
            break;
        case 4:
            r = t, g = p, b = v;
            break;
        case 5:
            r = v, g = p, b = q;
            break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
}
;
var DebugOpcodes = {
    0x00E0: 'CLS',
    0x00EE: 'RTS',
    0x1000: 'JMP ',
    0x2000: 'CALL NNN',
    0x3000: 'SE Vx, NN',
    0x4000: 'SNE Vx, NN',
    0x5000: 'SE Vx, Vy',
    0x6000: 'LD Vx, NN',
    0x7000: 'ADD Vx, NN',
    0x8000: 'MULTI',
    0x9000: 'SNE Vx, Vy',
    0xA000: 'LD I, NNN',
    0xB000: 'JMP V0 + NNN',
    0xC000: 'LD Vx, RAND AND NN',
    0xD000: 'Draw',
    0xE000: 'Keys',
    0xF000: 'Multi'
};
var VM = (function () {
    function VM(e) {
        this.running = false;
        this.PC = 0x200;
        this.I = 0;
        this.Stack = Array(16);
        this.DelayTimer = 0;
        this.SoundTimer = 0;
        this.sprFont = [
            0xF0, 0x90, 0x90, 0x90, 0xF0,
            0x20, 0x60, 0x20, 0x20, 0x70,
            0xF0, 0x10, 0xF0, 0x80, 0xF0,
            0xF0, 0x10, 0xF0, 0x10, 0xF0,
            0x90, 0x90, 0xF0, 0x10, 0x10,
            0xF0, 0x80, 0xF0, 0x10, 0xF0,
            0xF0, 0x80, 0xF0, 0x90, 0xF0,
            0xF0, 0x10, 0x20, 0x40, 0x40,
            0xF0, 0x90, 0xF0, 0x90, 0xF0,
            0xF0, 0x90, 0xF0, 0x10, 0xF0,
            0xF0, 0x90, 0xF0, 0x90, 0x90,
            0xE0, 0x90, 0xE0, 0x90, 0xE0,
            0xF0, 0x80, 0x80, 0x80, 0xF0,
            0xE0, 0x90, 0x90, 0x90, 0xE0,
            0xF0, 0x80, 0xF0, 0x80, 0xF0,
            0xF0, 0x80, 0xF0, 0x80, 0x80
        ];
        this.memoryViewCtx = this.memoryView = null;
        this.running = false;
        this.drawFlag = true;
        this.canvasEl = e;
        this.sWidth = e.width;
        this.sHeight = e.height;
        this.context = e.getContext('2d');
        this.cImageData = new ImageData(64, 32);
        this.sBuf = new ArrayBuffer(this.cImageData.data.length);
        this.sBuf8 = new Uint8ClampedArray(this.sBuf);
        this.sData = new Uint32Array(this.sBuf);
        this.V = new Uint8Array(new ArrayBuffer(16));
        this.Stack = new Array();
        this.Mem = new Uint8Array(new ArrayBuffer(4096));
        this.display = new Uint8Array(new ArrayBuffer(2048));
        this.Keys = new Uint8Array(new ArrayBuffer(16));
    }
    VM.prototype.clearDisplay = function () {
        this.display = new Uint8Array(new ArrayBuffer(2048));
    };
    VM.prototype.reset = function () {
        this.running = false;
        this.PC = 0x200;
        this.I = 0;
        this.clearDisplay();
        this.V = new Uint8Array(new ArrayBuffer(16));
        this.Stack = new Array();
        this.Mem = new Uint8Array(new ArrayBuffer(4096));
        this.display = new Uint8Array(new ArrayBuffer(2048));
    };
    VM.prototype.LoadRom = function (data) {
        this.reset();
        for (var i = 0; i < 80; ++i)
            this.Mem[i] = this.sprFont[i];
        for (var i = 0; i < data.length; ++i)
            this.Mem[i + 512] = data[i];
        this.running = true;
    };
    VM.prototype.DrawPixel = function (x, y) {
        if (x > 64 - 1)
            while (x > 64 - 1)
                x -= 64;
        if (x < 0)
            while (x < 0)
                x += 64;
        if (y > 32 - 1)
            while (y > 32 - 1)
                y -= 32;
        if (y < 0)
            while (y < 0)
                y += 32;
        var pos = x + (y * 64);
        var collide = false;
        this.display[pos] = this.display[pos] ^ 1;
        return !this.display[pos];
    };
    VM.prototype.Execute = function () {
        var opcode = this.Mem[this.PC] << 8 | this.Mem[this.PC + 1];
        var x = (opcode & 0x0F00) >> 8;
        var y = (opcode & 0x00F0) >> 4;
        var nnn = (opcode & 0x0FFF);
        this.PC += 2;
        switch (opcode & 0xF000) {
            case 0x0000:
                switch (opcode) {
                    case 0x00E0:
                        this.clearDisplay();
                        break;
                    case 0x00EE:
                        this.PC = this.Stack.pop();
                        break;
                    default:
                        break;
                }
                break;
            case 0x1000:
                this.PC = nnn;
                break;
            case 0x2000:
                this.Stack.push(this.PC);
                this.PC = nnn;
                break;
            case 0x3000:
                if (this.V[x] == (opcode & 0xFF)) {
                    this.PC += 2;
                }
                break;
            case 0x4000:
                if (this.V[x] != (opcode & 0xFF)) {
                    this.PC += 2;
                }
                break;
            case 0x5000:
                if (this.V[x] == this.V[y])
                    this.PC += 2;
                break;
            case 0x6000:
                this.V[x] = (opcode & 0xFF);
                break;
            case 0x7000:
                this.V[x] += (opcode & 0xFF);
                break;
            case 0x8000:
                switch (opcode & 0x000F) {
                    case 0x0000:
                        this.V[x] = this.V[y];
                        break;
                    case 0x0001:
                        this.V[x] |= this.V[y];
                        break;
                    case 0x0002:
                        this.V[x] &= this.V[y];
                        break;
                    case 0x0003:
                        this.V[x] ^= this.V[y];
                        break;
                    case 0x0004:
                        this.V[x] += this.V[y];
                        if (this.V[x] + this.V[y] > 255)
                            this.V[0xF] = 1;
                        else
                            this.V[0xF] = 0;
                        break;
                    case 0x0005:
                        this.V[0xF] = +(this.V[x] > this.V[y]);
                        this.V[x] -= this.V[y];
                        break;
                    case 0x0006:
                        this.V[0xF] = this.V[x] & 1;
                        this.V[x] >>= 1;
                        break;
                    case 0x0007:
                        this.V[0xF] = +(this.V[y] > this.V[x]);
                        this.V[x] = this.V[y] - this.V[x];
                        break;
                    case 0x000E:
                        this.V[0xF] = +(this.V[x] & 0x80);
                        this.V[x] = this.V[x] << 1;
                        break;
                }
                break;
            case 0x9000:
                if (this.V[x] != this.V[y])
                    this.PC += 2;
                break;
            case 0xA000:
                this.I = nnn;
                break;
            case 0xB000:
                this.PC = nnn + this.V[0];
                break;
            case 0xC000:
                this.V[x] = getRandomByte() & (opcode & 0xFF);
                break;
            case 0xD000:
                this.V[0xF] = 0;
                var height = (opcode & 0x000F);
                var rX = this.V[x];
                var rY = this.V[y];
                for (var y = 0; y < height; y++) {
                    var spr = this.Mem[this.I + y];
                    for (var x = 0; x < 8; x++) {
                        if ((spr & 0x80) > 0) {
                            if (this.DrawPixel(rX + x, rY + y))
                                this.V[0xF] = 1;
                        }
                        spr <<= 1;
                    }
                }
                this.drawFlag = true;
                break;
            case 0xE000:
                switch (opcode & 0x00FF) {
                    case 0x009E:
                        if (this.Keys[this.V[x]])
                            this.PC += 2;
                        break;
                    case 0x00A1:
                        if (this.Keys[this.V[x]] == 0)
                            this.PC += 2;
                        break;
                }
                break;
            case 0xF000:
                switch (opcode & 0x00FF) {
                    case 0x0007:
                        this.V[x] = this.DelayTimer;
                        break;
                    case 0x000A:
                        this.PC -= 2;
                        this.Keys.forEach(function (v) {
                            if (v != 0) {
                                this.V[x] = this.Keys[v];
                                this.PC += 2;
                                return;
                            }
                        }.bind(this));
                        break;
                    case 0x0015:
                        this.DelayTimer = this.V[x];
                        break;
                    case 0x0018:
                        this.SoundTimer = this.V[x];
                        break;
                    case 0x001E:
                        this.I = (this.I + this.V[x]) & 0xFFFF;
                        break;
                    case 0x0029:
                        this.I = this.V[x] * 5;
                        break;
                    case 0x0033:
                        this.Mem[this.I] = this.V[x] / 100;
                        this.Mem[this.I + 1] = this.V[x] % 100 / 10;
                        this.Mem[this.I + 2] = this.V[x] % 10;
                        break;
                    case 0x0055:
                        for (var i = 0; i < this.V[x]; i++) {
                            this.Mem[this.I + i] = this.V[i];
                        }
                        break;
                    case 0x0065:
                        for (var i = 0; i < this.V[x]; i++) {
                            this.V[x] = this.Mem[this.I + i];
                        }
                        break;
                }
                break;
            default:
                console.log('unknown opcode: ' + opcode.toString(16));
                break;
        }
        if (this.DelayTimer > 0)
            this.DelayTimer--;
        if (this.SoundTimer > 0)
            this.SoundTimer--;
        if (this.SoundTimer == 1)
            console.log('Beep :D');
    };
    VM.prototype.update = function (ignore) {
        if (ignore === void 0) { ignore = null; }
        if (!ignore)
            if (!this.running)
                return false;
        this.Execute();
    };
    VM.prototype.render = function (ignore) {
        if (ignore === void 0) { ignore = null; }
        if (!ignore)
            if (!this.running)
                return false;
        if (this.memoryView !== null) {
            var imageData = this.memoryViewCtx.getImageData(0, 0, 64, 64);
            var buf = new ArrayBuffer(imageData.data.length);
            var buf8 = new Uint8ClampedArray(buf);
            var data = new Uint32Array(buf);
            for (var x = 0; x < 64; x++) {
                for (var y = 0; y < 64; y++) {
                    var tx = (this.Mem[y * 64 + x] >> 4);
                    var ty = (this.Mem[y * 64 + x] & 0xf);
                    var c = HSVtoRGB((tx / 15), 1, (ty / 15));
                    if ((tx == 0) && (tx == ty)) {
                        data[y * 64 * x] = -1;
                    }
                    else {
                        data[y * 64 + x] =
                            (255 << 24) |
                                (c.b << 16) |
                                (c.g << 8) |
                                (c.r);
                    }
                }
            }
            imageData.data.set(buf8);
            this.memoryViewCtx.clearRect(0, 0, 64, 64);
            this.memoryViewCtx.putImageData(imageData, 0, 0);
            this.memoryViewCtx.drawImage(this.memoryView, 0, 0);
        }
        if (!this.drawFlag)
            return false;
        for (var i = 0; i < 2048; i++) {
            if (this.display[i] == 1)
                this.sData[i] = 255 << 24 | 0;
            else
                this.sData[i] = -1;
        }
        this.cImageData.data.set(this.sBuf8);
        this.context.putImageData(this.cImageData, 0, 0);
        this.drawFlag = false;
    };
    return VM;
}());
function ready(fn) { if (document.readyState != 'loading') {
    fn();
}
else {
    document.addEventListener('DOMContentLoaded', fn);
} }
ready(function () {
    var e = $('#gDisplay');
    var vm = new VM(e);
    vm.memoryView = $('#memView');
    vm.memoryViewCtx = vm.memoryView.getContext('2d');
    $('#btn-load-rom').addEventListener('click', function (e) {
        $('#rFile').click();
        e.preventDefault();
    });
    $('#btn-run').addEventListener('click', function (e) {
        vm.running = true;
        e.preventDefault();
    });
    $('#btn-step').addEventListener('click', function (e) {
        vm.running = false;
        var opcode = vm.Mem[vm.PC] << 8 | vm.Mem[vm.PC + 1];
        console.log('Opcode 0x' + (("0000" + (opcode).toString(16)).substr(-4)));
        var prettyReg = '[' + vm.V.toString().split(',').map(function (e) { return '0x' + parseInt(e).toString(16) + ', '; }).join('') + ']';
        console.log('Registers: ' + prettyReg);
        console.log('I: 0x' + vm.I.toString(16));
        console.log('Stack: ' + '[' + vm.Stack.map(function (e) { return '0x' + e.toString(16); }).join('') + ']');
        vm.update(true);
        if (vm.drawFlag)
            vm.render(true);
        e.preventDefault();
    });
    $('#btn-pause').addEventListener('click', function (e) {
        vm.running = false;
        e.preventDefault();
    });
    $('#btn-stop').addEventListener('click', function (e) {
        vm.reset();
        e.preventDefault();
    });
    $('#btn-reset').addEventListener('click', function (e) {
        vm.reset();
        e.preventDefault();
    });
    function keypad(code, pressed) {
        switch (code) {
            case 0x31:
                vm.Keys[0x0] = pressed;
                break;
            case 0x32:
                vm.Keys[0x1] = pressed;
                break;
            case 0x33:
                vm.Keys[0x2] = pressed;
                break;
            case 0x34:
                vm.Keys[0x3] = pressed;
                break;
            case 0x51:
            case 0x71:
                vm.Keys[0x4] = pressed;
                break;
            case 0x77:
            case 0x57:
                vm.Keys[0x5] = pressed;
                break;
            case 0x45:
            case 0x65:
                vm.Keys[0x6] = pressed;
                break;
            case 0x52:
            case 0x72:
                vm.Keys[0x7] = pressed;
                break;
            case 0x41:
            case 0x61:
                vm.Keys[0x8] = pressed;
                break;
            case 0x53:
            case 0x73:
                vm.Keys[0x9] = pressed;
                break;
            case 0x44:
            case 0x64:
                vm.Keys[0xA] = pressed;
                break;
            case 0x46:
            case 0x66:
                vm.Keys[0xB] = pressed;
                break;
            case 0x5A:
            case 0x79:
                vm.Keys[0xC] = pressed;
                break;
            case 0x58:
            case 0x78:
                vm.Keys[0xD] = pressed;
                break;
            case 0x43:
            case 0x63:
                vm.Keys[0xE] = pressed;
                break;
            case 0x56:
            case 0x76:
                vm.Keys[0xF] = pressed;
                break;
        }
    }
    $('body').addEventListener('keydown', function (e) {
        keypad(e.which, 1);
    });
    $('body').addEventListener('keyup', function (e) {
        keypad(e.which, 0);
    });
    var fileLoad = $('#rFile');
    fileLoad.addEventListener('change', function (evt) {
        var file = fileLoad.files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
            vm.LoadRom(new Uint8Array(reader.result));
        };
        reader.readAsArrayBuffer(file);
    });
    var updateLoop = setInterval(function () {
        vm.update();
    }, 1);
    var renderLoop = function () {
        vm.render();
        window.requestAnimationFrame(renderLoop);
    };
    renderLoop();
});
