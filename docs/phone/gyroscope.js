/**
* @typedef {Object} AngularVelocity - sample of angular velocity
* @property {number} x - velocity over x axis
* @property {number} y - velocity over y axis
* @property {number} z - velocity over z axis
*/

/**
 * @callback AngularVelocityCallback
 * @param {AngularVelocity} gyr - angular velocity measurement
 */

export default {
    gyroscope: null,
    startTS: 0,

    /**
     * Checks if sensor is available
     * @returns {boolean} true if available
     */
    isAvailable () {
        if (typeof Gyroscope === "function") {
            return true
        } else return false
    },

    /**
     * Asks for permissions
     * @returns {PromiseLike<boolean>} promise passes true if persmissions are given
     */
    async requestPermission () {
        const perms = await navigator.permissions.query({ name: "gyroscope" })
        if (perms.state === "denied") {
            return false
        } else return true
    },


    /**
     * Starts getting acceleration samples
     * @param {number} freq - sampling frequency in hertz
     * @param {AngularVelocityCallback} cbk - callback where samples are sent
     * @returns 
     */
    async startNotifications (freq, cbk) {
        this.startTS = new Date().getTime()
        let firstSample = true

        if (!freq) freq = 60

        return new Promise((resolve, reject) => {
            try {
                this.gyroscope = new Gyroscope({ referenceFrame: "device", frequency: freq })
                this.gyroscope.addEventListener("error", (event) => {
                    reject(event.error)
                })
                this.gyroscope.addEventListener("reading", (gyro) => {
                    if (firstSample) resolve()
                    firstSample = false

                    const sample = {
                        msFromStart: new Date().getTime() - this.startTS,
                        timestamp: gyro.timeStamp,
                        rotRate: {
                            x: gyro.x,
                            y: gyro.y,
                            z: gyro.z
                        },
                        interval: 1000 / freq
                    }
                    cbk(sample)
                })
                this.gyroscope.start()
                resolve()
            } catch (error) {
                reject(error)
            }
        })
    },

    /**
     * Stops the notifications
     */
    async stopNotifications () {
        if (this.gyroscope) this.gyroscope.stop()
    }

}