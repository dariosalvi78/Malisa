import { BleDevice } from "./bledevice.js"

/**
 * Heart rate monitor BLE device implementation.
 * Adapted from https://github.com/WebBluetoothCG/demos/blob/gh-pages/heart-rate-sensor/heartRateSensor.js
 */
export class HeartRateSensor extends BleDevice {
    /**
    * @typedef {Object} HRMeasurement - heart rate measurement object
    * @property {number} heartRate - heart rate in bpm
    * @property {boolean} contactDetected - true if contact with skin is detected
    * @property {number=} energyExpended - an optional energy expended
    * @property {number[]=} rrIntervals - an optional array of rr intervals in ms
    */

    /**
     * @callback HRMcallback
     * @param {HRMeasurement} hrm - heart rate measurement
     */

    /**
     * Create a new HRM sensors instance
     * @param {string} namePrefix - prefix used to find the device by name
     * @param {HRMcallback} hrmcallback - function called when an heart rate measurement is received
     */
    constructor(namePrefix, hrmcallback) {
        super()
        this.hrmcallback = hrmcallback
        this.namePrefix = namePrefix
    }

    /**
     * Scans for devices and connects to the sensor
     */
    async connect () {
        return super.connect(this.namePrefix, 'heart_rate', 'heart_rate_measurement')
    }

    /**
     * Starts receiving notifications from the sensor
     * @returns {PromiseLike}
     */
    async startNotificationsHeartRateMeasurement () {
        return this.startNotifications('heart_rate_measurement', (event) => {
            const value = event.target.value
            var heartRateMeasurement = this.parseHeartRate(value)
            this.hrmcallback(heartRateMeasurement)
        })
    }

    /**
     * Stops receiving notifications from the sensor
     * @returns 
     */
    async stopNotificationsHeartRateMeasurement () {
        return this.stopNotifications('heart_rate_measurement')
    }

    /**
     * Parses raw bytes into HRM
     * @param {*} value - raw bytes as received from BLE characteristic
     * @returns {HRMeasurement} the parsed measurement
     */
    parseHeartRate (value) {
        // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
        value = value.buffer ? value : new DataView(value)
        let flags = value.getUint8(0)
        let rate16Bits = flags & 0x1

        /** @type {HRMeasurement} */
        let result = {}

        let index = 1
        if (rate16Bits) {
            result.heartRate = value.getUint16(index, /*littleEndian=*/true)
            index += 2
        } else {
            result.heartRate = value.getUint8(index)
            index += 1
        }
        let contactDetected = flags & 0x2
        let contactSensorPresent = flags & 0x4
        if (contactSensorPresent) {
            result.contactDetected = !!contactDetected
        }
        let energyPresent = flags & 0x8
        if (energyPresent) {
            result.energyExpended = value.getUint16(index, /*littleEndian=*/true)
            index += 2
        }
        let rrIntervalPresent = flags & 0x10
        if (rrIntervalPresent) {
            let rrIntervals = []
            for (; index + 1 < value.byteLength; index += 2) {
                rrIntervals.push(value.getUint16(index, /*littleEndian=*/true))
            }
            result.rrIntervals = rrIntervals
        }
        return result
    }
}