class Promise {
    constructor(executor) {
        // promise 有三个状态 pending  fulfilled rejected
        this.status = 'pending';
        this.value = undefined;
        this.reason = undefined;
        let self = this;
        // 1.存放成功或失败的回调(类似与发布订阅)
        self.onResolveCallbacks = [];
        self.onRejectedCallbacks = [];

        let resolve = (value) => { // 变成成功态
            // 11.遇到resolve(Promise对象),应该先取出Promise执行完的结果，再将它传入下一个then
            if (value instanceof Promise) {
                return value.then(resolve, reject)
            }
            if (self.status === 'pending') {
                self.value = value;
                self.status = 'fulfilled';
                // 1.执行resolve,将成功的值传递(发布)
                self.onResolveCallbacks.forEach(fn => fn())
            }
        };

        let reject = (reason) => { // 变成是失败态
            if (self.status === 'pending') {
                self.reason = reason;
                self.status = 'rejected';
                self.onRejectedCallbacks.forEach(fn => fn())
            }
        };

        // 3.防止一上来就throw error
        try{
            executor(resolve, reject);
        }catch(e){
            reject(e);
        }
    };

    then(onfulfilled, onrejected) {
        // 参数的可选
        // 10.值得穿透 then().then().catch((data)=>{});
        onfulfilled = typeof onfulfilled === 'function' ? onfulfilled : val => val;
        onrejected = typeof onrejected == 'function' ? onrejected : err => { throw err }
        let self = this;
        // 2.每个promise必须返回一个新的状态 保证可以链式调用
        let promise2 = new Promise(function (resolve, reject) {
            if (self.status === 'fulfilled') {
                // 5. 因为生成promise2是一个异步操作,所以resolvePromise中的promise2可能没值，解决:setTimeout
                setTimeout(() => {
                    try {
                        // 4.提出公用
                        let x = onfulfilled(self.value);
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (e) {
                        reject(e);
                    }
                })
            }
            if (self.status === 'rejected') {
                setTimeout(() => {
                    try {
                        let x = onrejected(self.reason);
                        resolvePromise(promise2, x, resolve, reject)
                    } catch (e) {
                        reject(e);
                    }
                })
            }
            if (self.status === 'pending') {
                // 1.将成功或失败的操作，存放到数组里(订阅)
                self.onResolveCallbacks.push(function () {
                    setTimeout(() => {
                        try {
                            let x = onfulfilled(self.value);
                            resolvePromise(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e);
                        }
                    })
                });
                self.onRejectedCallbacks.push(function () {
                    setTimeout(() => {
                        try {
                            let x = onrejected(self.reason);
                            resolvePromise(promise2, x, resolve, reject)
                        } catch (e) {
                            reject(e);
                        }
                    })
                })
            }
        });
        return promise2
    };

    // catch是then的简写
    catch(errCallback) {
        return this.then(null, errCallback)
    };

    finally(callback) {
        return this.then(function (value) { // 成功
            return Promise.resolve(callback()).then(() => {
                return value
            })
        }, function (reason) { // 失败
            return Promise.resolve(callback()).then(() => {
                throw reason
            })
        })
    }

};

// 这个方法要兼容别人的promise  严谨一些  这个方法 要兼容别人的promise 
function resolvePromise(promise2, x, resolve, reject) {
    if (promise2 === x) { // 6.防止返回的promise 和 then方法返回的promise 是同一个
        return reject(new TypeError('循环引用'));
    }
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) { // {}
        // 10.设置flag,仅允许状态改变一次,即 pending->fullfilled 或 pending->rejected
        let called;
        try {
            let then = x.then;  // 7.看看这个对象有没有then方法，如果有 说明x是promise   ｛then:undefined｝
            if (typeof then === 'function') {
                // 不能使用x.then()，否则相当于再向下取了一层
                // 9.then中返回的是: promise对象 (y),此时需要递归解析
                then.call(x, y => {
                    if (called) return
                    called = true;
                    // 8.如果返回的是一个promise这个promise，resolve的结果可能还是一个promise，递归解析直到这个y是一个常量为止
                    resolvePromise(promise2, y, resolve, reject)
                }, r => {
                    if (called) return // 防止调用失败 又调用成功
                    called = true;
                    reject(r);
                });
            } else {
                // 9. then中返回的是: 普通值
                resolve(x); // {then:{}} {then:123}
            }
        } catch (e) { // 这个then方法 是通过 ObjectDefineProperty定义的
            if (called) return
            called = true; // 这个判断为了防止出错后 继续要调用成功逻辑
            reject(e);
        }
    } else {
        resolve(x); // x就是普通常量
    }
};

// A+ 规范进行检测
Promise.deferred = function () {
    let dfd = {};
    dfd.promise = new Promise((resolve, reject) => {
        dfd.resolve = resolve;
        dfd.reject = reject;
    });
    return dfd;
};

// 上来就创建一个成功的promise ／ 失败的promise
Promise.reject = function (reason) {
    return new Promise((resolve, reject) => {
        reject(reason);
    })
};
Promise.resolve = function (value) {
    return new Promise((resolve, reject) => {
        resolve(value);
    })
};

Promise.all = function (values) {
    return new Promise((resolve, reject) => {
        let arr = [];
        let count = 0;
        function processData(key, value) {
            arr[key] = value; // 将结果和数据 对应起来
            // 因为是异步等待，所以需要count进行累计
            if (++count === values.length) {
                resolve(arr); // 成功后 把结果抛出来
            }
        }
        for (let i = 0; i < values.length; i++) {
            let current = values[i];
            let then = current.then;
            if (then && typeof then === 'function') { // 是一个promise
                then.call(current, y => { // 是promise的就让promise执行
                    processData(i, y);
                }, reject); // 如果其中一个promose出错 就停止执行
            } else {
                processData(i, current); // 常量直接返回即可
            }
        };
    })
};

Promise.race = function (values) {
    return new Promise((resolve, reject) => {
        for (let i = 0; i < values.length; i++) {
            let current = values[i];
            let then = current.then;
            if (then && typeof then === 'function') { // 是一个promise
                then.call(current, y => { // 是promise的就让promise执行
                    resolve(y);
                }, reject); // 如果其中一个promose出错 就停止执行
            } else {
                resolve(current);
            }
        };
    })
};

module.exports = Promise;