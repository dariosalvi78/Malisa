import { BleDevice } from "./bledevice.js"

/**
 * Running speed and cadence BLE sensor implementation.
 * Adapted from https://github.com/WebBluetoothCG/demos/blob/gh-pages/heart-rate-sensor/heartRateSensor.js
 */
export class RunningSpeedCadenceSensor extends BleDevice {

    /**
    * @typedef {Object} RSCMeasurement - running speend and cadence measurement object
    * @property {boolean} isRunning - true if running, walking otherwise
    * @property {number} instantaneousSpeed - speed in m/s
    * @property {number} instantaneousCadence - foot step / minute
    * @property {number=} instantaneousStrideLength - an optional stride lenght
    * @property {number=} totalDistance - an optional total walked distance
    */

    /**
     * @callback RSCcallback
     * @param {RSCMeasurement} rcs - running speed and cadence measurement
     */

    /**
     * Creates a new sensor instance
     * @param {string} namePrefix - prefix to be used to detect the device
     * @param {RSCcallback} rsccallback - callback when data is available
     */
    constructor(namePrefix, rsccallback) {
        super()
        this.rsccallback = rsccallback
        this.namePrefix = namePrefix
    }


    /**
     * Connects to the sensor
     * @returns {PromiseLike} 
     */
    async connect () {
        // rsc_measurement see https://github.com/WebBluetoothCG/registries/blob/master/gatt_assigned_characteristics.txt
        // running_speed_and_cadence see https://github.com/WebBluetoothCG/registries/blob/master/gatt_assigned_services.txt
        return super.connect(this.namePrefix, 'running_speed_and_cadence', 'rsc_measurement')
    }

    /**
     * Starts the running speed and cadence measurements
     * @returns {PromiseLike}
     */
    async startNotificationsRSCMeasurement () {
        return this.startNotifications('rsc_measurement', (event) => {
            const value = event.target.value
            var rsc_measurement = this.parseRSC(value)
            this.rsccallback(rsc_measurement)
        })
    }

    /**
     * Stops the running speed and cadence measurements
     * @returns {PromiseLike}
     */
    async stopNotificationsRSCMeasurement () {
        return this.stopNotifications('rsc_measurement')
    }

    /**
     * Parses the raw bytes
     * @param {DataView} value - bytes as received by the sensor
     * @returns {RSCMeasurement}
     */
    parseRSC (value) {
        // see https://www.bluetooth.com/specifications/specs/running-speed-and-cadence-service-1-0/
        // Included in the characteristic value are a Flags field(for showing the
        // presence of optional fields and, if supported by the Server, whether the user is walking
        // or running), an Instantaneous Speed field, an Instantaneous Cadence field, depending
        // upon the contents of the Flags field, an Instantaneous Stride Length field and a Total
        // Distance field.

        // parsing based on: https://github.com/xuyuanme/ble-android/blob/master/nRFToolbox/src/no/nordicsemi/android/nrftoolbox/rsc/RSCManager.java#L190

        let result = {}

        // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
        value = value.buffer ? value : new DataView(value)

        let offset = 0
        let flags = value.getUint8(offset)
        let instaStrideLenFlag = (flags & 0x1) != 0 //Instantaneous Stride Length Present
        let totDistFlag = (flags & 0x2) != 0 //Total Distance Present bits
        let walkOrRunFlag = (flags & 0x4) != 0 //Walking or Running Status bit: 1 is running, 0 otherwise

        result.isRunning = walkOrRunFlag

        offset += 1

        // Instantaneous Speed is always present (256 units = 1 meter/second)
        let instantaneousSpeed = value.getUint16(offset, /*littleEndian=*/ true)
        result.instantaneousSpeed = (instantaneousSpeed / 256.0)

        offset += 2

        // Instantaneous Cadence (number of times per minute a foot fall occurs) is always present
        result.instantaneousCadence = value.getUint8(offset)
        offset += 1

        // Instantaneous Stride Length is optional
        if (instaStrideLenFlag) {
            result.instantaneousStrideLength = value.getUint16(offset, /*littleEndian=*/ true)
            offset += 2
        }

        // Total Distance Field is optional
        if (totDistFlag) {
            result.totalDistance = value.getUint32(offset, /*littleEndian=*/ true)
            offset += 4
        }

        return result
    }
}