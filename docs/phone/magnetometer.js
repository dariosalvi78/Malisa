/**
* @typedef {Object} MagneticField - sample of magentic field
* @property {number} x - magentic field over x axis
* @property {number} y - magentic field over y axis
* @property {number} z - magentic field over z axis
*/

/**
 * @callback MagneticFieldCallback
 * @param {MagneticField} mgf - magentic field measurement
 */

export default {
    magnetometer: null,
    startTS: 0,

    /**
     * Checks if sensor is available
     * @returns {boolean} true if available
     */
    isAvailable () {
        if (typeof Magnetometer === "function") {
            return true
        } else return false
    },

    /**
     * Asks for permissions
     * @returns {PromiseLike<boolean>} promise passes true if persmissions are given
     */
    async requestPermission () {
        const perms = await navigator.permissions.query({ name: "magnetometer" })
        if (perms.state === "denied") {
            return false
        } else return true
    },


    /**
     * Starts getting magnetometer samples
     * @param {number} freq - sampling frequency in hertz
     * @param {MagneticFieldCallback} cbk - callback where samples are sent
     * @returns 
     */
    async startNotifications (freq, cbk) {
        this.startTS = new Date().getTime()
        let firstSample = true

        if (!freq) freq = 60

        return new Promise((resolve, reject) => {
            try {
                this.magnetometer = new Magnetometer({ referenceFrame: "device", frequency: freq })
                this.magnetometer.addEventListener("error", (event) => {
                    reject(event.error)
                })
                this.magnetometer.addEventListener("reading", (mgf) => {
                    if (firstSample) resolve()
                    firstSample = false

                    const sample = {
                        msFromStart: new Date().getTime() - this.startTS,
                        timestamp: mgf.timeStamp,
                        rotRate: {
                            x: mgf.x,
                            y: mgf.y,
                            z: mgf.z
                        },
                        interval: 1000 / freq
                    }
                    cbk(sample)
                })
                this.magnetometer.start()
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
        if (this.magnetometer) this.magnetometer.stop()
    }

}