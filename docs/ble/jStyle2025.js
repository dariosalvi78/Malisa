import { BleDevice } from "./bledevice.js"
import jStyle2025CMDs from "./jStyle2025CMDs.js"
import CMDS from './jStyle2025CMDs.js'

/**
 * JStyle 2025 protocol, reverse engineered
 */
export class JStyle2025 extends BleDevice {

    /**
    * @typedef {Object} DeviceTime - time set on the watch
    * @property {number} year - year
    * @property {number} month - month (1-12)
    * @property {number} day - day of the month
    * @property {number} hour - hour (0-23)
    * @property {number} minutes - minutes (0-59)
    * @property {number} seconds - seconds (0-59)
    * @property {string} gpsDate - date according to GPS
    */

    /**
    * @typedef {Object} UserProfile - user profile info
    * @property {number} gender - 1 for male, 2 for female
    * @property {number} age - in years
    * @property {number} height - in cm
    * @property {number} weight - in kg
    * @property {number} strideLength - in cm
    * @property {string} userDeviceId - ?
    */



    #DATA_Service_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
    #TX_Characteristic_UUID = '0000fff6-0000-1000-8000-00805f9b34fb'
    #RX_Characteristic_UUID = '0000fff7-0000-1000-8000-00805f9b34fb'

    #replyCallbacks = {}

    /**
     * Creates a new sensor instance
     * @param {string} namePrefix - prefix to be used to detect the device
     */
    constructor(namePrefix) {
        super()
        this.namePrefix = namePrefix
    }


    /**
     * Connects to the sensor
     * @returns {PromiseLike} 
     */
    async connect () {
        await super.connect(this.namePrefix, this.#DATA_Service_UUID, [this.#RX_Characteristic_UUID, this.#TX_Characteristic_UUID])
        return this.startNotifications(this.#RX_Characteristic_UUID, (event) => {
            const value = event.target.value
            console.log('Got data', value)
            // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
            const btvalues = value.buffer ? value : new DataView(value)
            if (btvalues.byteLength > 0) {
                let cmd = btvalues.getUint8(0)

                if (this.#replyCallbacks[cmd]) {
                    this.#replyCallbacks[cmd](btvalues)
                } else {
                    console.error('No callback for command ' + cmd)
                }

            } else {
                console.error('Response with no data?')
            }
        })
    }

    /**
     * Sends a command to the watch, adds a final CRC too
     * @param {number} command - command to be sent, as a number (should fit within 1 byte)
     * @param {DataView} data - any associated data, as DataView, should be no longer than 14 bytes
     * @returns {PromiseLike} 
     */
    async #sendCommand (command, data) {
        let outData = new Uint8Array(16)
        // copy command
        outData[0] = command & 0xff

        let crc = 0
        for (let i = 0; i < outData.length - 1; i++) {
            // copy the data
            if ((data != null) && (i > 0) && (i < data.byteLength)) {
                outData[i] = data.getUint8(i - 1)
            }
            crc += outData[i]
        }
        // add CRC
        outData[outData.length - 1] = crc & 0xff

        return super.writeCharacteristicValue(this.#TX_Characteristic_UUID, outData)
    }

    #fromNumAsHexToNumAsDec (num) {
        return parseInt(num.toString(16))
    }

    #fromNumAsDecToNumAsHex (num) {
        return parseInt('' + num, 16)
    }


    /**
     * Waits for a reply to a given command
     * @returns {Promise<DataView>} 
     */
    async #waitForReply (command) {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(() => {
                // time out no reply !
                delete this.#replyCallbacks[command]
                console.error('timeout!')
                reject()
            }, 500)
            this.#replyCallbacks[command] = (btvalues) => {
                // got a reply before timeout
                clearTimeout(timeoutId)
                delete this.#replyCallbacks[command]
                resolve(btvalues)
            }
        })

    }

    /**
     * Gets the device version as string
     * @returns {Promise<string>}
     */
    async getDeviceVersion () {
        let replyPromise = this.#waitForReply(CMDS.getDeviceVersion).then((btvalues) => {
            console.log('Got device version reply ' + btvalues)
            let ver = btvalues.getUint8(1) + '.' + btvalues.getUint8(2) + '.' + btvalues.getUint8(3) + '.' + btvalues.getUint8(4)
            return ver
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.getDeviceVersion)
        return replyPromise
    }

    /**
     * Gets the device battery level
     * @returns {Promise<number>}
     */
    async getBatteryLevel () {
        let replyPromise = this.#waitForReply(CMDS.getBatteryLevel).then((btvalues) => {
            console.log('Got device battery reply ' + btvalues)
            let level = btvalues.getUint8(1)
            return level
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.getBatteryLevel)
        return replyPromise
    }

    /**
     * Gets the device time
     * @returns {Promise<DeviceTime>}
     */
    async getTime () {
        let replyPromise = this.#waitForReply(CMDS.getTime).then((btvalues) => {
            console.log('Got device time reply ' + btvalues)
            /** @type {DeviceTime} */
            let deviceTime = {
                year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(1)),
                month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(2)),
                day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                gpsDate: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(9)) + '.' + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(10)) + '.' + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(11))
            }
            return deviceTime
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.getTime)
        return replyPromise
    }

    /**
     * Sets the clock date and time
     * @param {Date} dateTime - current date and time as JS date
     */
    async setTime (dateTime) {

        // message, contains 8 bytes
        const buffer = new ArrayBuffer(8)
        // same buffer, as dataview
        let dateTimeConfig = new DataView(buffer)

        let yearPost2k = dateTime.getFullYear() - 2000
        dateTimeConfig.setUint8(0, this.#fromNumAsDecToNumAsHex(yearPost2k))

        let monthFrom1 = dateTime.getMonth() + 1
        dateTimeConfig.setUint8(1, this.#fromNumAsDecToNumAsHex(monthFrom1))

        let day = dateTime.getDate()
        dateTimeConfig.setUint8(2, this.#fromNumAsDecToNumAsHex(day))

        let hour = dateTime.getHours()
        dateTimeConfig.setUint8(3, this.#fromNumAsDecToNumAsHex(hour))

        let minutes = dateTime.getMinutes()
        dateTimeConfig.setUint8(4, this.#fromNumAsDecToNumAsHex(minutes))

        let secs = dateTime.getSeconds()
        dateTimeConfig.setUint8(5, this.#fromNumAsDecToNumAsHex(secs))

        // time zone offset in hours
        let offset = 0
        let TZOffsetH = Math.round((- dateTime.getTimezoneOffset()) / 60)
        if (TZOffsetH < 0) {
            // offset is stored as ABS
            offset = -TZOffsetH
        } else {
            // offset is offsetted!
            offset = TZOffsetH + 0x80
        }

        dateTimeConfig.setUint8(7, offset)

        let replyPromise = this.#waitForReply(CMDS.setTime).then((btvalues) => {
            console.log('Got device time set OK ' + btvalues)
            return
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.setTime, dateTimeConfig)
        return replyPromise
    }

    /**
    * Gets the user profile infor
    * @returns {Promise<UserProfile>}
    */
    async getUserProfile () {
        let replyPromise = this.#waitForReply(CMDS.getUserProfile).then((btvalues) => {
            console.log('Got user profile ' + btvalues)
            const decoder = new TextDecoder()
            const userDeviceIdDV = new DataView(btvalues.buffer, 6, 5)
            const userDeviceId = decoder.decode(userDeviceIdDV)
            /** @type {UserProfile} */
            let userProfile = {
                gender: btvalues.getUint8(1),
                age: btvalues.getUint8(2),
                height: btvalues.getUint8(3),
                weight: btvalues.getUint8(4),
                strideLength: btvalues.getUint8(5),
                userDeviceId: userDeviceId,
            }
            return userProfile
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.getUserProfile)
        return replyPromise
    }

    /**
    * Sets the user profile
    * @param {UserProfile} profile - user profile
    */
    async setUserProfile (profile) {

        const buffer = new ArrayBuffer(5)
        // same buffer, as dataview
        let userProfileDV = new DataView(buffer)

        userProfileDV.setUint8(0, profile.gender)
        userProfileDV.setUint8(1, profile.age)
        userProfileDV.setUint8(2, profile.height)
        userProfileDV.setUint8(3, profile.weight)
        userProfileDV.setUint8(4, profile.strideLength)

        let replyPromise = this.#waitForReply(CMDS.setUserProfile).then((btvalues) => {
            console.log('Got user profile set OK ' + btvalues)
            return
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.setUserProfile, userProfileDV)
        return replyPromise
    }

    /**
    * Clears data from watch
    */
    async clearData () {
        let replyPromise = this.#waitForReply(CMDS.clearData).then((btvalues) => {
            console.log('Got clear data OK ' + btvalues)
            return
        })
        await this.#sendCommand(CMDS.clearData)
        return replyPromise
    }

    /**
    * Queries activity data
    */
    async getActivityHistory (fromDate) {
        let activityHistory = []

        let historyConfigDV = new DataView(new ArrayBuffer(6))
        historyConfigDV.setUint8(0, 0) // mode: 0=start, 2=continue, 0x99=delete

        if (fromDate) {
            let yearPost2k = fromDate.getFullYear() - 2000
            historyConfigDV.setUint8(3, this.#fromNumAsDecToNumAsHex(yearPost2k))

            let monthFrom1 = fromDate.getMonth() + 1
            historyConfigDV.setUint8(4, this.#fromNumAsDecToNumAsHex(monthFrom1))

            let day = fromDate.getDate()
            historyConfigDV.setUint8(5, this.#fromNumAsDecToNumAsHex(day))
        }

        let getOneRecord = async (btvalues) => {
            console.log('Got activity history data', btvalues)
            // we should stop receiving, no more data is expected
            let shouldFinish = false

            // records take either 26 or 27 bytes
            // additionally, an "end record" (record with just the end flag) takes only 2 bytes
            let recordSize = 27
            const packetLen = btvalues.byteLength
            if (packetLen >= 26) {
                if (length % 26 == 0) {
                    recordSize = 26
                } else if (length % 27 == 0) {
                    recordSize = 27
                } else {
                    // cases where the packet size is not mulitple of 27 or 26 bytes
                    // the packet may contain an extra "end record"
                    if ((length - 2) % 26 == 0) {
                        recordSize = 26
                    } else if ((length - 2) % 27 == 0) {
                        goal = 27
                    } else {
                        // packet size is strange, let's finish acquisition
                        shouldFinish = true
                    }
                }
                // get the number of records in this packet
                const nRecords = Math.floor(packetLen / recordSize)
                if (nRecords == 0) {
                    // no more data is expected to arrive
                    shouldFinish = true
                } else {
                    for (let i = 0; i < nRecords; i++) {
                        // structure of an activity record:
                        // byte 0 = command
                        // byte 1 = record counter if 0xff = no more records (end record)
                        // byte 2 = year (minus 2000)
                        // byte 3 = month
                        // byte 4 = day of month
                        // bytes 5-8 = step count
                        // bytes 9-12 = time
                        // bytes 13-16 = distance (x 100)
                        // bytes 17-20 = calories (x 100)
                        // rest is unknown...

                        if (btvalues.getUint8(i * recordSize) == CMDS.getActivityHistory) {
                            let recordCount = btvalues.getUint8(1 + i * recordSize)
                            if (recordCount == 0xff) {
                                // no more data
                                // this should not happen, because there is more data
                                shouldFinish = true
                            }
                            let activityRecord = {
                                year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(2 + i * recordSize)),
                                month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3 + i * recordSize)),
                                day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4 + i * recordSize)),
                                steps: btvalues.getUint32(5 + i * recordSize, true), // 32 bits u integer, little endian
                                time: btvalues.getUint32(9 + i * recordSize, true),
                                distance: btvalues.getUint32(13 + i * recordSize, true) / 100,
                                calories: btvalues.getUint32(17 + i * recordSize, true) / 100
                            }
                            console.log(activityRecord)
                            activityHistory.push(activityRecord)
                        } else {
                            // shouldn't happen, maybe the recordsize is not well estimated?
                        }

                    }
                    // if there is any record left
                    if (packetLen > nRecords * recordSize) {
                        // maybe there's the end record?
                        if (btvalues.getUint8(nRecords * recordSize) == CMDS.getActivityHistory) {
                            if (btvalues.getUint8((nRecords * recordSize) + 1) == 0xff) {
                                shouldFinish = true
                            }
                        }
                    }
                }
            } else {
                // not enough data just signal that it's finished
                shouldFinish = true
            }

            if (shouldFinish) {
                // no need to get more records, return the ones we have so far
                return activityHistory
            } else {
                // get next record, repeat
                // wait for the next packet to arrive:
                let replyPromise = this.#waitForReply(CMDS.getActivityHistory).then(getOneRecord)

                // send the continue message:
                historyConfigDV.setUint8(0, 2) // mode: 0=start, 2=continue, 0x99=delete
                this.#sendCommand(CMDS.getActivityHistory, historyConfigDV)
                return replyPromise
            }
        }
        let replyPromise = this.#waitForReply(CMDS.getActivityHistory).then(getOneRecord)

        await this.#sendCommand(CMDS.getActivityHistory, historyConfigDV)
        return replyPromise
    }

}