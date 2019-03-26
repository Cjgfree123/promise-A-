let Promise = require('./my-promise')

// Promise.reject(123).catch(data=>{
//     console.log(data);
// })

// let p = new Promise((resolve,reject)=>{
//     resolve(new Promise((resolve,reject)=>{
//         setTimeout(()=>{
//             resolve(100)
//         },1000)
//     }))
// })
// p.then((r)=>{
//     console.log(r);
// });


// finally 检测
let p = new Promise((resolve,reject)=>{
    reject('123');
});

p.catch(err=>{
    console.log(err);
}).then(data=>{
    return 100
}).finally((data)=>{ // 无论如何都执行
    console.log('1000');
}).then(data=>{
    console.log(data);
}).catch(err=>{
    console.log('err',err)
})
