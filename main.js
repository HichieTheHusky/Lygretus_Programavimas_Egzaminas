const { start, dispatch, stop, spawnStateless, spawn, spawnPersistent } = require('nact');
const system = start();
const fs = require('fs')
const fileName = "C:\\Users\\lukas\\Documents\\GitHub\\untitled\\Lyg_egzas\\IFF-8-8_ZumarasLukas_L1_dat_2.json";
const rezfileName = "C:\\Users\\lukas\\Documents\\GitHub\\untitled\\Lyg_egzas\\IFF-8-8_ZumarasLukas_L1_rez.txt";
const MAIN_THREAD = "main";
const WORKER_THREAD = "worker";
const DISPATCHER_THREAD = "dispatcher";
const PRINTER_THREAD = "printer";
const SAFE_THREAD = "safe";
const WORKER_FILTER = 50;
const WORKER_COUNT = 2;
const DATA_COUNT = 25;
const ACTION_START = "start";
const ACTION_RUN = "Running";
const ACTION_FINISH = "Finished";
const ACTION_CHECK = "Check";
const workers = Array.from(Array(WORKER_COUNT).keys());

const dispatcher = spawn(
    system, // parent
    (state = {}, msg, ctx) => {

        if (msg.sender == MAIN_THREAD) {
            if (msg.type == ACTION_RUN) {
                childActor = ctx.children.get(WORKER_THREAD + (msg.index % 2));
                dispatch(childActor, {type: ACTION_RUN, element: msg.element})
                return state;
            } else {
                workers.forEach(element => {
                    childActor = ctx.children.get(WORKER_THREAD + element);
                    dispatch(childActor, {type: ACTION_FINISH})
                });
            }
        }
        if (msg.sender == WORKER_THREAD) {
            if (msg.type == ACTION_RUN)
            {
                dispatch(safe, {type: ACTION_START, element: msg.element})
                return state;
            }
            if (msg.type == ACTION_FINISH)
            {
                return {...state, [msg.name]: true};
            }
            if (msg.type == ACTION_CHECK) {
                const status = workers.every(function (element) {
                    if (state[WORKER_THREAD + element] === undefined) {
                        return false;
                    } else {
                        return true;
                    }
                });
                if(status)
                {
                    dispatch(safe, {type: ACTION_FINISH})
                    dispatch(printer, {type: ACTION_START})
                }
                return state;
            }
        }
        if (msg.sender == SAFE_THREAD)
        {
            dispatch(printer,{type: ACTION_RUN, element: msg.element})
        }
    }, // function
    DISPATCHER_THREAD // name
);

const safe = spawn(
    dispatcher, // parent
    (state = {safeArray:[]}, msg, ctx) => {
        if(msg.type == ACTION_FINISH)
        {
            const safeArray = state['safeArray'];
            safeArray.forEach(element => dispatch(dispatcher,{sender: SAFE_THREAD, element: element}))
        }
        else{
            const hasStarted = state[msg.type] !== undefined;
            if(hasStarted) {
                const safeArray = state['safeArray'];
                safeArray.push(msg.element)
                safeArray.sort(function(a, b) {
                    return parseFloat(a.Performance) - parseFloat(b.Performance);
                });
                return { ...state, safeArray: safeArray };
            } else {
                const safeArray = [];
                safeArray.push(msg.element);
                return { ...state, [msg.type]: true, safeArray: safeArray };
            }
        }
    }, // function
    SAFE_THREAD // name
);

const printer = spawn(
    dispatcher, // parent
    (state, msg, ctx) => {
        if(msg.type == ACTION_START)
        {
            const start = fs.createWriteStream(rezfileName, {flags: 'w'});
            start.end();

            const fileStream = fs.createWriteStream(rezfileName, {flags:'a'});
            fileStream.write('\n'+ 'Lentelė : '+ '\n' +
                ('                                                Pavadinimas |').slice(-40) +
                ('                                                Kaina |').slice(-8) +
                ('                                                Gretis |').slice(-10) +
                ' Santikis'+ '\n')
            return { ...state, ['stream']: fileStream };
            // writeStream.end();
        } else {
            const fileStream = state['stream'];
            fileStream.write(('         '+msg.element.Name).slice(-38) + (' |') +
                ('     '+msg.element.MSRP).slice(-6) + (' |') +
                ('     '+msg.element.Score).slice(-8) + (' | ') +
                msg.element.Performance  + '\n')
            return { ...state, ['stream']: fileStream };
        }
    }, // function
    PRINTER_THREAD // name
);

const worker = (workerName) => spawnStateless(
    dispatcher, // parent
    (msg, ctx) => {
        if(msg.type == ACTION_RUN){
            if((msg.element.MSRP / msg.element.Score) < WORKER_FILTER)
            {
                msg.element.Performance = (msg.element.MSRP / msg.element.Score);
                dispatch(dispatcher, {type: ACTION_RUN, sender: WORKER_THREAD, element: msg.element});
            }
        } else {
            dispatch(dispatcher, {type: ACTION_FINISH, sender: WORKER_THREAD, name: ctx.name});
            dispatch(dispatcher, {type: ACTION_CHECK, sender: WORKER_THREAD, name: ctx.name});
        }

    }, // function
    workerName // name
);

workers.forEach(element => worker(WORKER_THREAD+element));

const json = require(fileName);
json.forEach((element,index) => {
    dispatch(dispatcher, {type: ACTION_RUN ,index: index, sender: MAIN_THREAD, element: element})
})
dispatch(dispatcher, {type: ACTION_FINISH, sender: MAIN_THREAD})
