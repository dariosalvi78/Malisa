/**
* @typedef {Object} Coordinates - geolocation coordinates
* @property {number} latitude
* @property {number} longitude
* @property {number} altitude
* @property {number} accuracy
* @property {number} altitudeAccuracy
* @property {number} heading
* @property {number} speed
*/

/**
* @typedef {Object} Location - sample of position
* @property {Coordinates} coords - coordinates
* @property {number} timestamp - timestamp as Unix timestamp in ms
*/


/**
 * @callback LocationCallback
 * @param {Location} loc - location
 */

export default {

    watchId: null,

    /**
     * Checks if geolocation is available
     * @returns {boolean} true if available
     */
    isAvailable () {
        if (typeof navigator.geolocation === 'object') {
            return true
        } else return false
    },

    /**
     * Requests permissions to start
     * @returns {PromiseLike<boolean>} promise passes true if persmissions are given
     */
    async requestPermission () {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(() => {
                resolve()
            }, (err) => {
                if (err.code == 1) reject()
                else resolve()
            }, {
                enableHighAccuracy: true,
                timeout: 1000,
                maximumAge: 10000,
            })
        })

    },

    /**
     * Starts getting location samples
     * @param {number} period - desired sampling period
     * @param {LocationCallback} cbk - callback where samples are sent
     * @returns 
     */
    async startNotifications (period, cbk) {

        let options = {
            enableHighAccuracy: false,
            timeout: period,
            maximumAge: 0,
        }

        this.watchId = navigator.geolocation.watchPosition((loc) => {
            cbk(loc)
        }, (err) => {
            console.error(err)
        }, options)
    },

    /**
     * Stops the notifications
     */
    async stopNotifications () {
        if (this.watchId) navigator.geolocation.clearWatch(this.watchId)
    }

}