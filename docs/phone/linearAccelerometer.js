/**
* @typedef {Object} LinearAcceleration - sample of acceleration excluding gravity
* @property {number} x - acceleration over x axis
* @property {number} y - acceleration over y axis
* @property {number} z - acceleration over z axis
*/


/**
 * @callback LinearAccelerationCallback
 * @param {LinearAcceleration} acc - acceleration measurement
 */

export default {
    accelerometer: null,
    startTS: 0,

    /**
     * Checks if sensor is available
     * @returns {boolean} true if available
     */
    isAvailable () {
        if (typeof LinearAccelerometer === "function") {
            return true
        } else return false
    },

    /**
     * Asks for permissions
     * @returns {PromiseLike<boolean>} promise passes true if persmissions are given
     */
    async requestPermission () {
        const perms = await navigator.permissions.query({ name: "accelerometer" })
        if (perms.state === "denied") {
            return false
        } else return true
    },


    /**
     * Starts getting acceleration samples
     * @param {number} freq - sampling frequency in hertz
     * @param {LinearAccelerationCallback} cbk - callback where samples are sent
     * @returns 
     */
    async startNotifications (freq, cbk) {
        this.startTS = new Date().getTime()
        let firstSample = true

        if (!freq) freq = 60

        return new Promise((resolve, reject) => {
            try {
                this.accelerometer = new LinearAccelerationSensor({ referenceFrame: "device", frequency: freq })
                this.accelerometer.addEventListener("error", (event) => {
                    reject(event.error)
                })
                this.accelerometer.addEventListener("reading", (acl) => {
                    if (firstSample) resolve()
                    firstSample = false

                    const sample = {
                        msFromStart: new Date().getTime() - this.startTS,
                        timestamp: acl.timeStamp,
                        acc: {
                            x: acl.x,
                            y: acl.y,
                            z: acl.z
                        },
                        interval: 1000 / freq
                    }
                    cbk(sample)
                })
                this.accelerometer.start()
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
        if (this.accelerometer) this.accelerometer.stop()
    }

}