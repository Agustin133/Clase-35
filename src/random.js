process.on('message', (msg) => {
    //console.log(msg)
    let sum = 0;
    if(msg != undefined){
        for(let i=0; i< msg*1e9; i++){
            sum += i;
        };
    }else if(msg == 1){
        for(let i=0; i< 1*1e9; i++){
            sum += i;
        };
    }
    process.send(sum);
})