/*=====================================================
ALU

Conjunto de funciones matemáticas.

*/

function ALU() {};

ALU.hexCa2ToInt = function (hex, bits) {
    var integer = parseInt(hex, 16); // 256 | 2
    return ca2ToInt(integer, bits);

};

ALU.ca2ToInt = function (number, bits) {
    //Si el último bit es 1 significa que el número es negativo.
    if ((number & (1 << (bits - 1))) > 0) {
        number--;
        //Generar máscara para calcular el Ca1.
        var mask = 1;
        for (var i = 0; i < bits - 1; i++) {
            mask = (mask << 1) | 1;
        }
        return - (number ^ mask);
    }
    return number;
}

/**
 * Devuelve la suma de dos números enteros.
 * @param n1 Número 1.
 * @param n2 Número 2.
 * @param bits Número de bits usados para codificar el número.
 * @returns {{result: number, carry: number}}
 */
ALU.sum = function (n1, n2, bits) {
    //Crear máscara para leer el bit más a la derecha.
    var carry = 0;
    var resultI = 0;

    for (var i = 0; i < bits; i++) {
        var b1 = n1 & 1;
        var b2 = n2 & 1;
        n1 = n1 >> 1;
        n2 = n2 >> 1;

        var s = ALU.bitSum(b1, b2, carry);
        resultI = (resultI << 1) | s.result;
        carry = s.carry;

    }

    var result = 0;

    //resultI guarda el resultado en orden inverso. Aquí
    //se invierte para que esté correctamente.
    for (var i = 0; i < bits; i++) {
        result = (result << 1) | (resultI & 1);
        resultI = resultI >> 1;
    }

    return {result: result, carry: carry};

};

/**
 * Suma de dos bits.
 * @param b1 Bit 1.
 * @param b2 Bit 2.
 * @param carry
 * @returns {{result: number, carry: number}}
 */
ALU.bitSum = function (b1, b2, carry) {
    var xor = b1 ^ b2;
    var and = b1 & b2;

    var sum = xor ^ carry;
    var and2 = xor & carry;

    var carry_out = and | and2;

    return {
        result: sum, carry: carry_out
    };
};

ALU.isNegative = function (number, bits) {
    var mask = 1 << (bits - 1);
    return (mask & number) > 0;
};

/*=====================================================
 REGISTROS

 -RA: contenido del registro contador.
 -PC: contador de programa.
 -SP: puntero de pila.
 -RET: dirección previa a la de retorno.
 -Z: si, tras una operación, RA es cero, Z = 1.
 -C: guarda el acarreo de la última operación.
 -N: si, tras una operación, RA es negativo, N = 1.

 */

function Registers() {
    this.reset();
}

Registers.prototype.reset = function () {
    this.regs = {
        ra: 0,
        ret: 0,
        pc: 0,
        z: 0,
        c: 0,
        n: 0,
        sp: 0
    };
};

Registers.prototype.get = function (reg) {
    return this.regs[reg.toLowerCase()];
};

Registers.prototype.set = function (reg, value) {
    this.regs[reg.toLowerCase()] = value;
    this.onUpdateCallback && this.onUpdateCallback(reg, value);

    //this.updateZero(reg);
};

Registers.prototype.incr = function (reg, value) {
    if (!value) value = 1;

    var newValue = ALU.sum(this.get(reg), value, 8);

    this.set(reg, newValue.result);

    this.updateZero(reg);
    this.updateCarry(reg, newValue.carry);
    this.updateNegative(reg);

    this.onUpdateCallback && this.onUpdateCallback(reg, value);
};

Registers.prototype.decr = function (reg, value) {
    if (!value) value = 1;

    this.incr(reg, -value);
};

Registers.prototype.updateZero = function (reg) {
    if ('ra' === reg.toLowerCase()) {
        if (this.get('RA') === 0) {
            this.set('Z', 1);
        }
        else {
            this.set('Z', 0);
        }
    }
};

Registers.prototype.updateCarry = function(reg, carry) {
    if ('ra' === reg.toLowerCase()) {
        this.set('C', carry);
    }
};

Registers.prototype.updateNegative = function (reg) {
    if ('ra' === reg.toLowerCase()) {
        this.set('N', ALU.isNegative(this.get('RA'), 8) ? 1 : 0);
    }
};

Registers.prototype.print = function () {
    console.log('RA: ' + this.get('RA'));
};

Registers.prototype.toString = function () {
    var str = '';
    str = str.concat('RA\t' + ALU.ca2ToInt(this.get('RA'), 8) + '\n');
    str = str.concat('PC\t' + this.get('PC') + '\n');
    str = str.concat('SP\t' + this.get('SP') + '\n');
    str = str.concat('Z\t' + this.get('Z') + '\n');
    str = str.concat('C\t' + this.get('C') + '\n');
    str = str.concat('N\t' + this.get('N') + '\n');
    return str;
};

Registers.prototype.onUpdate = function (func) {
    this.onUpdateCallback = func;
};


/*=====================================================
 MEMORIA PRINCIPAL

 Contiene un array 'bytes' con el contenido de la memoria.
 Los datos se almacenan en formato decimal.

 La clase tiene un puntero llamado "assemblyPointer" hacia
 una posición de memoria que determina en qué posición
 guardar el siguiente byte de código durante el ensamblado.

 La memoria recibe como parámetro:
  -Los registros. Los necesita para acceder al contador de programa (PC).
  -Tamaño de la memoria (opcional). Por defecto es 256.

 */

function Memory(registers, size) {
    this.registers = registers;
    this.size = size ? size : 256;
    this.clear();
}


//Escribe bytes de manera sucesiva. Usado durante el ensamblado.
Memory.prototype.writeByte = function (byte) {
    this.bytes[this.assemblyPointer] = byte;
    this.assemblyPointer++;
}

//Reinicia la memoria.
Memory.prototype.clear = function () {
    this.bytes = [];
    for (var i = 0; i < this.size; i++) {
        this.bytes.push(0);
    }
    this.assemblyPointer = 0;
}

//Lee el contenido apuntado por el contador de programa.
Memory.prototype.readByte = function () {
    return this.bytes[this.registers.get('PC')];
}

//Mueve hacia adelante el contador de programa.
//Devuelve el contenido de la memoria en ese punto.
Memory.prototype.nextByte = function () {
    this.registers.incr('PC');
    return this.bytes[this.registers.get('PC')];
}

//Escribir un valor en una dirección.
Memory.prototype.writeAddress = function (address, value) {
    this.bytes[address] = value;

    if (this.onUpdateCallback) this.onUpdateCallback(this);
}

//Leer un valor de una dirección.
Memory.prototype.readAddress = function (address) {
    return this.bytes[address];
}

Memory.prototype.print = function () {
    console.log(this.bytes);
}

Memory.prototype.onUpdate = function (func) {
    this.onUpdateCallback = func;
}

/*=====================================================
 INPUT/OUTPUT
 */

function IO() {
    this.output = 0;
}

/*Método para establecer el valor de la salida.*/
IO.prototype.setOutput = function (output) {
    this.output = ALU.ca2ToInt(output, 8);
    this.onUpdateOutputCallback && this.onUpdateOutputCallback(this.output);
};

/*Método para solicitar la entrada de un dato.*/
IO.prototype.getInputRequest = function (func) {
    this.onInputRequestCallback && this.onInputRequestCallback(func);
};

IO.prototype.onOutputUpdate = function (func) {
    this.onUpdateOutputCallback = func;
};

IO.prototype.onInputRequest = function (func) {
    this.onInputRequestCallback = func;
}

/*=====================================================
 FUNCIONES DE ENSAMBLAJE Y COMPROBACIÓN DE PARÁMETROS

 Las siguientes funciones comprueban si determinada instrucción
 tiene unos parámetros correctos (p. ej.: MOVE RA, 66 -> OK; MOVE BB, 66 -> ERROR)

 Además se encarga de escribir en la memoria la instrucción. Cada función
 se encarga de almacenar un tipo determinado de instrucción.

 Si siguen un formato incorrecto las funciones devolverán false y si es correcto true.

 */

function writeAddress(dirOrTag, memory, environment) {
    //La dirección que se quiere guardar en la memoria
    // puede se una dirección real o una etiqueta.

    if (environment.isTag(dirOrTag)) {
        //Si es una etiqueta se añade a la lista de etiquetas
        //sin resolver. (Las etiquetas son resueltas más tarde).
        environment.addUnresolvedTag(dirOrTag, memory.assemblyPointer);
        //Como se desconoce la dirección de salto, se guarda un 0
        //de manera provisional.
        memory.writeByte(0);
    }
    else {
        //Si es una dirección real tan sólo hay que
        //guardar la dirección.
        memory.writeByte(parseInt(dirOrTag, 16));
    }
}

/*
 Ensamblaje de instrucciones que se codifican con un sólo byte
 como STOP o INC RA
 */
function oneByteAssembly(memory, params) {
    memory.writeByte(this.code);
    return true;
}

/*
 Ensamblaje de instrucciones que se codifican con dos bytes
 y que tienen el formato MNEMOTECNICO + RA + DIRECCION/VALOR
 */
function raValueAssembly(memory, params, environment) {
    if (params[0] !== 'RA') return false;

    memory.writeByte(this.code);
    //La entrada viene codificada en hexadecimal pero se convierte
    //a entero.

    //TODO: COMPROBAR FORMATO DE params[1]

    writeAddress(params[1], memory, environment);
    //memory.writeByte(parseInt(params[1], 16));

    return true;
}

/*
 Ensamblaje de la instrucción MOVE que puede tener dos formas:
 -MOVE RA, DIR
 -MOVE DIR, RA
 Hay que diferenciarlas usando su código.
 */

function moveAssembly(memory, params, environment) {
    if (this.code === 1 && params[0] === 'RA') {
        memory.writeByte(this.code);
        //TODO
        //memory.writeByte(parseInt(params[1], 16));
        writeAddress(params[1], memory, environment);
        return true;
    }
    else if (this.code === 2 && params[1] === 'RA') {
        memory.writeByte(this.code);
        //TODO
        //memory.writeByte(parseInt(params[0], 16));
        writeAddress(params[0], memory, environment);
        return true;
    }
    else {
        return false;
    }
}

/*
 Ensamblaje de instrucciones que se codifican con dos bytes
 y que tienen el formano MNEMOTECNICO + DIRECCION/VALOR.
 */
function valueDirAssembly(memory, params, environment) {
    memory.writeByte(this.code);
    writeAddress(params[0], memory, environment);
    return true;
}

/*=====================================================
 SET DE INSTRUCCIONES

 El siguiente array almacena el juego de instrucciones del Easy8
 junto con información sobre la instrucción:
 -mnemotic: código mnemotécnico de la instrucción.
 -code: código (decimal) que se usará para el ensamblado.
 -assembly: función que se ejecutará cuando se esté ensamblado
 la instrucción. La función recibe los siguientes parámetros:
     -memory: la memoria principal donde se escribirá la función.
     -params: array con los parámetros de la instrucción.
     -environtment: instancia del RuntimeEnvirontment.

 La función assembly deberá comprobar que los parámetros
 tienen el formato correcto. Si es así, deberá devolver
 true. Si no, devolverá false.
 La función assembly debe escribir en la memoria la
 codificación de la instrucción junto con los parámetros,
 si los tiene.
 -run: la función de ejecución de la instrucción. Recibe como
 parámetros:
    -memory: memoria principal.
    -registers: registros.
    -io: instancia de IO.
    -environment: instancia del entorno de ejecución.

 Si la función devuelve true se terminará la ejecución del programa,
 como haría la instrucción STOP.
 Si la función devuelve false o no devuelve nada, la ejecución
 sigue su curso.

 */

var instructionSet = [
    /*CODIFICADOS EN UN BYTE*/
    {
        mnemotic: 'STOP',
        code: 21,
        assembly: oneByteAssembly,
        run: function () {
            return true; //Fin de la ejecución.
        }
    },
    {
        mnemotic: 'INC',
        code: 7,
        assembly: oneByteAssembly,
        run: function (memory, registers) {
            registers.incr('RA');
        }
    },
    {
        mnemotic: 'DEC',
        code: 8,
        assembly: oneByteAssembly,
        run: function (memory, registers) {
            registers.decr('RA');
        }
    },
    {
        mnemotic: 'PUSH',
        code: 15,
        assembly: oneByteAssembly,
        run: function (memory, registers) {
            memory.writeAddress(registers.get('SP'), registers.get('RA'));
            registers.decr('SP', 1);
        }
    },
    {
        mnemotic: 'POP',
        code: 16,
        assembly: oneByteAssembly,
        run: function (memory, registers) {
            if (registers.get('SP') < memory.size - 1) {
                //TODO: ¿se pone a 0?
                registers.incr('SP', 1);
                memory.writeAddress(registers.get('SP'), 0);
            }
        }
    },
    {
        mnemotic: 'RET',
        code: 18,
        assembly: oneByteAssembly,
        run: function (memory, registers) {
            registers.set('PC', registers.get('RET'));
        }
    },
    /*CODIFICADOS EN DOS BYTES*/
    {
        mnemotic: 'MOVEI',
        code: 0,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            registers.set('RA', memory.nextByte());
        }
    },
    {
        mnemotic: 'MOVE',
        code: 1,
        assembly: moveAssembly,
        run: function (memory, registers) {
            var addr = memory.nextByte();
            registers.set('RA', memory.readAddress(addr));
        }
    },
    {
        mnemotic: 'MOVE',
        code: 2,
        assembly: moveAssembly,
        run: function (memory, registers) {
            var v = memory.nextByte();
            memory.writeAddress(v, registers.get('RA'));
        }
    },
    {
        mnemotic: 'ADDI',
        code: 3,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            registers.incr('RA', memory.nextByte());
        }
    },
    {
        mnemotic: 'ADD',
        code: 4,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            var addr = memory.nextByte();
            registers.incr('RA', memory.readAddress(addr));
        }
    },
    {
        mnemotic: 'SUBI',
        code: 5,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            registers.decr('RA', memory.nextByte());
        }
    },
    {
        mnemotic: 'SUB',
        code: 6,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            var addr = memory.nextByte();
            registers.decr('RA', memory.readAddress(addr));
        }
    },
    {
        mnemotic: 'COMPAREI',
        code: 9,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            var val = memory.nextByte();
            var res = ALU.sum(registers.get('RA'), -val, 8);
            registers.set('Z', res.result === 0 ? 1 : 0);
            registers.set('N', ALU.isNegative(res.result, 8) ? 1 : 0);
            registers.set('C', res.carry);
        }
    },
    {
        mnemotic: 'COMPARE',
        code: 10,
        assembly: raValueAssembly,
        run: function (memory, registers) {
            var val = memory.readAddress(memory.nextByte());
            var res = ALU.sum(registers.get('RA'), -val, 8);
            registers.set('Z', res.result === 0 ? 1 : 0);
            registers.set('N', ALU.isNegative(res.result, 8) ? 1 : 0);
            registers.set('C', res.carry);
        }
    },
    {
        mnemotic: 'JUMP',
        code: 11,
        assembly: valueDirAssembly,
        run: function (memory, registers, environment) {
            //Memory.nextByte() desplaza el PC a la
            //siguiente posición y devuelve el contenido
            //de la memoria en ese punto. En este caso, esa posición
            //contiene la dirección objetivo del salto.
            var target = memory.nextByte();

            //Se establece el contador de programa
            //para que la siguiente instrucción a ejecutar
            //sea a la que apunta target. Hay que restar 1 porque
            //después de ejecutar esta función se pasa al siguiente byte.
            registers.set('PC', target - 1);

        }
    },
    {
        mnemotic: 'JLESS',
        code: 12,
        assembly: valueDirAssembly,
        run: function (memory, registers) {
            var target = memory.nextByte();

            if (registers.get('N')) {
                registers.set('PC', target - 1);
            }
        }
    },
    {
        mnemotic: 'JGREATER',
        code: 13,
        assembly: valueDirAssembly,
        run: function (memory, registers) {
            var target = memory.nextByte();

            if (!registers.get('N') && !registers.get('Z')) {
                registers.set('PC', target - 1);
            }
        }
    },
    {
        mnemotic: 'JEQUAL',
        code: 14,
        assembly: valueDirAssembly,
        run: function (memory, registers) {
            var target = memory.nextByte();
            if (registers.get('Z') === 1) {
                registers.set('PC', target - 1);
            }
        }
    },
    {
        mnemotic: 'CALL',
        code: 17,
        assembly: valueDirAssembly,
        run: function (memory, registers) {
            registers.set('RET', registers.get('PC') + 1);
            //Se suma +1 para que registers.ret apunte a
            //la dirección donde está el parámetro del CALL
            //y no al propio CALL. Nota: cuando se dan saltos registers.ret
            //debe ser la dirección anterior al objetivo porque
            //en el bucle de ejecución de las instrucciones se realizará
            //un incremento justo después de la ejecución del salto.
            var target = memory.nextByte() - 1;
            registers.set('PC', target);

        }
    },
    {
        mnemotic: 'IN',
        code: 19,
        assembly: valueDirAssembly,
        run: function (memory, registers, io, runtimeEnvironment) {
            if (memory.nextByte() == 0) {
                runtimeEnvironment.sleep();
                io.getInputRequest(function (input) {
                    registers.set('RA', parseInt(input, 16));
                    runtimeEnvironment.wakeUp();
                    console.log('retomar ejecucion: ' + registers.get('PC'));
                });
            }
        }
    },
    {
        mnemotic: 'OUT',
        code: 20,
        assembly: valueDirAssembly,
        run: function (memory, registers, io) {
            var port = memory.nextByte();
            if (port == 1) {
                io.setOutput(registers.get('RA'));
            }
        }
    },
    {
        mnemotic: 'SLEEP',
        code: 22,
        assembly: valueDirAssembly,
        run: function (memory, registers, io, runtimeEnvironment) {
            runtimeEnvironment.sleep(memory.nextByte() * 1000);
        }
    },
    {
        mnemotic: 'RAND',
        code: 23,
        assembly: oneByteAssembly,
        run: function (memory, registers) {
            registers.set('RA', Math.floor(Math.random() * 255) + 1);
        }
    },
    {
        mnemotic: 'BYTE',
        code: -1,
        assembly: function (memory, params) {
            memory.writeByte(parseInt(params[0], 16));
            return true;
        }
    }

];

/*=====================================================
* SIMULADOR DE EJECUCIÓN
*
* */

function RuntimeEnvironment() {
    this.registers = new Registers();
    this.memory = new Memory(this.registers);
    this.io = new IO();

    this.int = null;
    this.running = false;
    this.sleeping = false;
    this.finished = false;

    this.tagsTable = {};
    this.unresolvedTags = [];

    this.callbacks = {};

}

RuntimeEnvironment.prototype.setCallbacks = function (callbacks) {
    /*Callbacks posibles:
     *
     * onMemoryUpdate -> la memoria principal ha sido actualizada.
     * onRegisterUpdate -> un registro ha sido actualizado.
     * onOutputUpdate -> la salida ha sido actualizada.
     * onSyntaxError -> error de sintaxis durante el ensamblado.
     * onInputRequest -> el programa solicita la entrada de algún dato.
     * */
    this.callbacks = callbacks;

    callbacks.onMemoryUpdate && this.memory.onUpdate(callbacks.onMemoryUpdate);
    callbacks.onRegistersUpdate && this.registers.onUpdate(callbacks.onRegistersUpdate);
    callbacks.onOutputUpdate && this.io.onOutputUpdate(callbacks.onOutputUpdate);
    callbacks.onInputRequest && this.io.onInputRequest(callbacks.onInputRequest);
};

RuntimeEnvironment.prototype.assembly = function (sourceCode) {
    this.sourceCode = sourceCode;

    var lines = sourceCode.split('\n');

    this.tagsTable = {};
    this.unresolvedTags = [];

    //Reiniciar la memoria.
    this.memory.clear();

    var success = true;

    for (var i = 0; i < lines.length; i++) {

        if (!lines[i]) {
            continue;
        }

        var tokens = this.parseLine(lines[i]);

        //tokens[0] debe contener el comentario si la línea es un comentario.
        //tokens[1] contiene el mnemotécnico.
        //tokens[2] y tokens[3] contendrán los parámetros, si procede.
        //token[4] contendrá la etiqueta.
        if (!tokens) {
            this.callbacks.onSyntaxError &&
            this.callbacks.onSyntaxError(lines[i]);
            success = false;
            break;
        }

        //Si tokens.tag tiene algún valor significa que
        //hay una etiqueta y hay que almacenar
        //la dirección en la tabla de etiquetas que se usará posteriormente
        //en la etapa de resolución.
        if (tokens.tag) {
            this.tagsTable[tokens.tag] = this.memory.assemblyPointer;
        }


        if (!tokens.mnemotecnic) {
            //Es un comentario o un blanco, se pasa a la siguiente línea.
            continue;
        }

        //Buscar las instrucciones que coinciden en el array instructionSet.
        //Generalmente solo habrá un resulado pero alguna instrucción
        //aparece dos veces.
        var instructions = getInstructionsByMnemotic(tokens.mnemotecnic);

        if (instructions.length === 0) {
            //No se ha encontrado la instrucción correspondiente a un
            //mnemotécnico. Probablemente está mal escrito.
            this.callbacks.onSyntaxError &&
            this.callbacks.onSyntaxError(lines[i]);
            success = false;
            break;
        }


        //TODO: si todas devuelven false, error de sintaxis.
        for (var j = 0; j < instructions.length; j++) {
            if (instructions[j].assembly(this.memory, [tokens.param1, tokens.param2], this)) {
                break;
            }
        }
    }

    //Etapa de resolución.
    if (!this.resolveTags()) {
        success = false;
        this.callbacks.onSyntaxError('Etiqueta no encontrada.');
    }

    if (!success) {
        this.memory.clear();
    }
};

RuntimeEnvironment.prototype.parseLine = function (line) {
    if (!line) return null;

    //La expresión regular comprueba que la instrucción tenga una de las
    //siguientes estructuras:
    //1. X Y Z  (P. ej.: MOVE RA, DIR)
    //2. X Y    (P. ej.: IN 01)
    //3. X      (P. ej.: STOP)
    //4. #COMENTARIO
    //5. [blancos]
    //Notar que la expresión regular se usa para comprobar la estructura
    //general de la instrucción y para tokenizarla. Sin embargo, los distintos
    //tokens no son validados. Ese trabajo se delega al método assembly de
    //la instrucción de turno.
    var results = line.match(/^(?:(?:\s*#.*)|(?:\s+)|(?:\s*(@\w+):\s*(?:#.*)?)|(?:\s*(?:(@\w+):)?\s*(\w+)(?:\s+(@?\w+)\s*(?:,\s*(@?\w+))?)?\s*(#.*)?))$/);

    if (!results) return null;

    return {
        tag: results[2] ? results[2] : results[1],
        mnemotecnic: results[3],
        param1: results[4],
        param2: results[5]
    };

};

RuntimeEnvironment.prototype.run = function () {
    //Si se provoca la ejecución cuando ya estaba
    //ejecutándose el programa se reinicia el intervalo.
    if (this.int) {
        clearInterval(this.int);
    }

    this.running = true;
    this.sleeping = false;

    this.resetProgram();

    var self = this;

    this.int = setInterval(function () {

        if (self.running && !self.sleeping) {
            self.runStep();
        }

    }, 2);
};

RuntimeEnvironment.prototype.runStep = function (goForward) {
    var byte = this.memory.readByte();
    console.log('PC: ' + this.registers.get('PC'));

    var instruction = getInstructionByCode(byte);
    console.log(instruction);

    if (!instruction) {
        console.log('Error de ejecución.');
        this.stop();
        //TODO
    }
    else if (!instruction.run) {
        console.log('Sin implementación para: ');
        console.log(instruction);
        this.stop();
    }
    else {
        if (instruction.run(this.memory, this.registers, this.io, this)) {
            this.stop();
        }
        else {
            //Cuando una instrucción detiene la ejecución se quiere
            //que el PC se mantenga en esa instrucción y no pase a
            //la siguiente.
            this.memory.nextByte();
        }
    }
};

RuntimeEnvironment.prototype.resetProgram = function () {
    //this.assembly(this.sourceCode);

    //Reiniciar registros.
    this.registers.reset();

    //El puntero de pila apunta al final de la memoria.
    this.registers.set('SP', this.memory.size - 1);
}

RuntimeEnvironment.prototype.stop = function () {
    this.running = false;
    this.sleeping = false;

    clearInterval(this.int);
};

RuntimeEnvironment.prototype.sleep = function (timeout) {
    this.sleeping = true;

    var self = this;

    if (timeout) {
        setTimeout(function () { self.wakeUp(); }, timeout);
    }
};

RuntimeEnvironment.prototype.wakeUp = function () {

    if (!this.sleeping) return;
    this.sleeping = false;
};

/*Si, durante el ensamblado, alguna instrucción hace referencia
* a una etiqueta, se almacena la etiqueta y en qué posición habría
* que guardar la dirección a la que referencia.
*
* Tras el ensamblado, cuando ya se deberían conocer las direcciones
* de todas las etiquetas, se inicia la etapa de resolución.
* */
RuntimeEnvironment.prototype.addUnresolvedTag = function (tag, memoryAddress) {
    //Se almacena la etiqueta del tag sin resolver
    //y la dirección en memoria DONDE SE DEBERÁ ESCRIBIR LA DIRECCIÓN DEFINITIVA.
    this.unresolvedTags.push({tag: tag, address: memoryAddress});
};

RuntimeEnvironment.prototype.isTag = function (token) {
    if (token[0] == '@') {
        return true;
    }
};

/*
* La etapa de resolución se inicia cuando se ha realizado el ensamblado.
* En este punto ya, salvo que el programador cometa un error, ya se
* conoce aqué dirección referencian todas las etiquetas.
* Por tanto, aquí habrá que buscar todas las instrucciones que usaban
* alguna etiqueta para reemplazarla por la dirección real en memoria.
* */
RuntimeEnvironment.prototype.resolveTags = function () {
    for (var i = 0; i < this.unresolvedTags.length; i++) {
        // address contendrá la dirección a la que se referencia
        var address = this.tagsTable[this.unresolvedTags[i].tag];
        if (address === undefined) {
            return false;
        }

        //unresolvedTags[i].address es la dirección donde se
        //usó la etiqueta y donde habrá que escribir la dirección
        //definitiva.
        this.memory.writeAddress(this.unresolvedTags[i].address, address);

    }

    return true;
}

/*
 AUXILIARES
 */

/*
 Devuelve las instrucciones que tienen como mnemotécnico
 el que se pasa por parámetro. Notar que devuelve un array
 porque puede haber varias instrucciones con el mismo
 mnemotécnico.
 */
function getInstructionsByMnemotic(mnemotic) {
    var resInstructions = [];

    for (var i = 0; i < instructionSet.length; i++) {
        if (instructionSet[i].mnemotic === mnemotic) {
            resInstructions.push(instructionSet[i]);
        }
    }

    return resInstructions;
}

function getInstructionByCode(code) {
    for (var i = 0; i < instructionSet.length; i++) {
        if (code === instructionSet[i].code) {
            return instructionSet[i];
        }
    }
    return null;
}