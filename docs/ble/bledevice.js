/**
 * Base class for BLE devices.
 * Adapted from https://github.com/WebBluetoothCG/demos/blob/gh-pages/heart-rate-sensor/heartRateSensor.js
 */
export class BleDevice {
    constructor() {
        this.device = null
        this.server = null
        this.characteristics = new Map()
        this.callbacks = new Map()
    }

    /**
    * Scans for devices and connects to the sensor
    */
    async connect (namePrefix, serviceName, characteristicName, onDisconnected) {
        this.device = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix },
                { services: [serviceName] }
            ]
        })
        if (onDisconnected) device.addEventListener('gattserverdisconnected', onDisconnected)

        this.server = await this.device.gatt.connect()
        let service = await this.server.getPrimaryService(serviceName)
        await this.cacheCharacteristic(service, characteristicName)
    }

    /**
     * Tells if the device is currently connected
     * @returns {boolean} true if the device is connected
     */
    isConnected () {
        if (this.device && this.device.gatt) return this.device.gatt.connected
        else return false
    }

    /**
     * Disconnects the device
     */
    disconnect () {
        if (this.device.gatt.connected) {
            this.device.gatt.disconnect()
        }
    }

    /**
     * Stores a characteristic to be used lated
     * @param {*} service - BLE service
     * @param {string} characteristicUuid - UUID of the characteristic
     * @returns {PromiseLike}
     */
    async cacheCharacteristic (service, characteristicUuid) {
        let characteristic = await service.getCharacteristic(characteristicUuid)
        this.characteristics.set(characteristicUuid, characteristic)
    }

    /**
     * Reads a characteristic
     * @param {string} characteristicUuid - UUID of the characteristic
     * @returns {PromiseLike}
     */
    async readCharacteristicValue (characteristicUuid) {
        let characteristic = this.characteristics.get(characteristicUuid)
        let value = await characteristic.readValue()
        // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
        value = value.buffer ? value : new DataView(value)
        return value
    }

    /**
     * Writes a characteristic
     * @param {string} characteristicUuid - UUID of the characteristic
     * @param {*} value - value to be written
     * @returns 
     */
    async writeCharacteristicValue (characteristicUuid, value) {
        let characteristic = this.characteristics.get(characteristicUuid)
        return characteristic.writeValue(value)
    }

    /**
     * Registers a callback to the notifications of a charecteristic
     * @param {string} characteristicUuid 
     * @param {*} callback 
     * @returns {PromiseLike}
     */
    async startNotifications (characteristicUuid, callback) {
        let characteristic = this.characteristics.get(characteristicUuid)
        await characteristic.startNotifications()
        this.callbacks.set(characteristicUuid, callback)
        characteristic.addEventListener('characteristicvaluechanged', callback)
    }

    /**
     * Stops notifications and deregister the callback
     * @param {string} characteristicUuid 
     * @returns {PromiseLike}
     */
    async stopNotifications (characteristicUuid) {
        let characteristic = this.characteristics.get(characteristicUuid)
        await characteristic.stopNotifications()
        let callback = this.callbacks.get(characteristicUuid)
        characteristic.removeEventListener('characteristicvaluechanged', callback)
    }
}