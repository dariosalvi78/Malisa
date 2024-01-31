import { BleDevice } from "./bledevice.js"

/**
 * Cycling speed and cadence BLE sensor implementation.
 * See https://www.bluetooth.com/specifications/specs/cycling-speed-and-cadence-service-1-0/
 */
export class CyclingSpeedCadenceSensor extends BleDevice {

    /**
    * @typedef {Object} CSCMeasurement - cycling speed and cadence measurement object
    * @property [number] cumulativeWheelRevolutions - number of revolutions of the wheel
    * @property [number] lastWheelEventTime - time when the last revolution was detected
    * @property [number] cumulativeCrankRevolutions - number of revolutions of the pedal crank
    * @property [number] lastCrankEventTime - time when the last revolution was detected
    */


    /**
     * @callback CSCcallback
     * @param {CSCMeasurement} csc - cycling cadence measurement
     */

    /**
     * Creates a new sensor instance
     * @param {string} namePrefix - prefix to be used to detect the device
     * @param {CSCcallback} csccallback - callback when data is available
     */
    constructor(namePrefix, csccallback) {
        super()
        this.csccallback = csccallback
        this.namePrefix = namePrefix
    }


    /**
     * Connects to the sensor
     * @returns {PromiseLike} 
     */
    async connect () {
        // csc_measurement see https://github.com/WebBluetoothCG/registries/blob/master/gatt_assigned_characteristics.txt
        // running_speed_and_cadence see https://github.com/WebBluetoothCG/registries/blob/master/gatt_assigned_services.txt
        return super.connect(this.namePrefix, 'cycling_speed_and_cadence', 'csc_measurement')
    }

    /**
     * Starts the running speed and cadence measurements
     * @returns {PromiseLike}
     */
    async startNotificationsCSCMeasurement () {
        return this.startNotifications('csc_measurement', (event) => {
            const value = event.target.value
            const csc_measurement = this.parseCSC(value)
            this.csccallback(csc_measurement)
        })
    }

    /**
     * Stops the running speed and cadence measurements
     * @returns {PromiseLike}
     */
    async stopNotificationsCSCMeasurement () {
        return this.stopNotifications('csc_measurement')
    }

    /**
     * Parses the raw bytes
     * @param {DataView} value - bytes as received by the sensor
     * @returns {CSCMeasurement}
     */
    parseCSC (value) {
        // see https://www.bluetooth.com/specifications/specs/cycling-speed-and-cadence-service-1-0/
        // parsing based on: https://github.com/xuyuanme/ble-android/blob/master/nRFToolbox/src/no/nordicsemi/android/nrftoolbox/csc/CSCManager.java

        /** @type{CSCMeasurement} */
        let result = {}

        // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
        value = value.buffer ? value : new DataView(value)

        let offset = 0
        let flags = value.getUint8(offset)
        // The Wheel Revolution Data Present bit (bit 0 of the Flags field) indicates whether or not
        // the Cumulative Wheel Revolutions and Last Wheel Event Time fields are present
        let hasWheelRevolutions = (flags & 0x1) != 0 // Wheel Revolution Data Present bit

        // The Crank Revolution Data Present bit (bit 1 of the Flags field) indicates whether or not
        // the Cumulative Crank Revolutions and the Last Crank Event Time fields are present.
        let hasCrankRevolutions = (flags & 0x2) != 0 // Crank Revolution Data Present bit

        offset += 1

        console.log('has wheel', hasWheelRevolutions)
        console.log('has crank', hasCrankRevolutions)

        if (hasWheelRevolutions) {
            result.cumulativeWheelRevolutions = value.getUint32(offset, /*littleEndian=*/ true)
            offset += 4;

            // The ‘wheel event time’ is a free - running - count of 1 / 1024 second units and it represents
            // the time when the wheel revolution was detected by the wheel rotation sensor.Since
            // several wheel events can occur between transmissions, only the Last Wheel Event
            // Time value is transmitted.This value is used in combination with the Cumulative Wheel
            // Revolutions value to enable the Client to calculate speed and distance.
            // The Last Wheel Event Time value rolls over every 64 seconds.
            const timestamp = value.getUint16(offset, /*littleEndian=*/ true)

            result.lastWheelEventTime = (timestamp / 1024) * 1000 // convert to ms

            offset += 2;
        }

        if (hasCrankRevolutions) {
            // The Cumulative Crank Revolutions value, which represents the number of times a crank
            // rotates, is used in combination with the Last Crank Event Time to determine 1) if the
            // cyclist is coasting and 2) the average cadence.Average cadence is not accurate unless
            // 0 cadence events(i.e.coasting) are subtracted.In addition, if there is link loss, the
            // Cumulative Crank Revolutions value can be used to calculate the average cadence
            // during the link loss.This value is intended to roll over and is not configurable.
            result.cumulativeCrankRevolutions = value.getUint16(offset, /*littleEndian=*/ true)
            offset += 2;

            // The ‘crank event time’ is a free-running-count of 1/1024 second units and it represents
            // the time when the crank revolution was detected by the crank rotation sensor.
            // The Last Crank Event Time value rolls over every 64 seconds.
            const timestamp = value.getUint16(offset, /*littleEndian=*/ true)
            result.lastCrankEventTime = (timestamp / 1024) * 1000 // convert to ms

            offset += 2;
        }

        return result
    }
}