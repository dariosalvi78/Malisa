import { BLEDevice } from "./bledevice.js"
import CMDS from './jStyle2025CMDs.js'

/**
 * JStyle 2025 protocol, reverse engineered
 * Compatible with 2025E, 2113E
 */
export class JStyle2025 extends BLEDevice {

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
    * @property {number} gender - 1 for male, 0 for female (as in the Android SDK MyPersonalInfo)
    * @property {number} age - in years
    * @property {number} height - in cm
    * @property {number} weight - in kg
    * @property {number} strideLength - in cm
    * @property {string} userDeviceId - ?
    */

    /**
    * @typedef {Object} DailyActivitySummary - summary of daily activity
    * @property {number} recordCount - count of the record
    * @property {number} year - year
    * @property {number} month - month (1-12)
    * @property {number} day - day of the month
    * @property {number} steps - number of steps
    * @property {number} exerciseMinutes - exercise time in minutes
    * @property {number} distance - distance in meters
    * @property {number} calories - calories burned
    * @property {number} goal - goal in steps
    * @property {number} activeMinutes - active minutes
    */

    /**
    * @typedef {Object} DetailedActivity - summary of detailed activity
    * @property {number} recordCount - count of the record
    * @property {number} year - year
    * @property {number} month - month (1-12)
    * @property {number} day - day of the month
    * @property {number} hour - hour (0-23)
    * @property {number} minutes - minutes (0-59)
    * @property {number} seconds - seconds (0-59)
    * @property {number} steps - number of steps
    * @property {number} calories - calories burned
    * @property {number} distance - distance in meters
    * @property {Array<number>} detailSteps - array of step details, each element is the number of steps per minute, 10 elements in total
    */

    /**
    * @typedef {Object} DetailedHR - detailed heart rate record
    * @property {number} recordCount - count of the record
    * @property {number} year - year
    * @property {number} month - month (1-12)
    * @property {number} day - day of the month
    * @property {number} hour - hour (0-23)
    * @property {number} minutes - minutes (0-59)
    * @property {number} seconds - seconds (0-59)
    * @property {Array<number>} hrs - each element is the heart rate in bpm, 15 elements in total
    */

    /**
    * @typedef {Object} HR - heart rate record
    * @property {number} recordCount - count of the record
    * @property {number} year - year
    * @property {number} month - month (1-12)
    * @property {number} day - day of the month
    * @property {number} hour - hour (0-23)
    * @property {number} minutes - minutes (0-59)
    * @property {number} seconds - seconds (0-59)
    * @property {number} hr - heart rate in bpm
    */

    /**
    * @typedef {Object} HRV - heart rate variability record
    * @property {number} recordCount - count of the record
    * @property {number} year - year
    * @property {number} month - month (1-12)
    * @property {number} day - day of the month
    * @property {number} hour - hour (0-23)
    * @property {number} minutes - minutes (0-59)
    * @property {number} seconds - seconds (0-59)
    * @property {number} hrv - heart rate variability in ms
    * @property {number} vascularAge - vascular age in years
    * @property {number} hr - heart rate in bpm
    * @property {number} stressLevel - stress level
    * @property {number} highBP - high blood pressure
    * @property {number} lowBP - low blood pressure
    */

    /**
     * @typedef {Object} SPO2 - blood oxygen saturation record
     * @property {number} recordCount - count of the record
     * @property {number} year - year
     * @property {number} month - month (1-12)
     * @property {number} day - day of the month
     * @property {number} hour - hour (0-23)
     * @property {number} minutes - minutes (0-59)
     * @property {number} seconds - seconds (0-59)
     * @property {number} spo2 - blood oxygen saturation in percentage
     */


    /**
     * @typedef {Object} Sleep - sleep record
     * @property {number} recordCount - count of the record
     * @property {number} year - year
     * @property {number} month - month (1-12)
     * @property {number} day - day of the month
     * @property {number} hour - hour (0-23)
     * @property {number} minutes - minutes (0-59)
     * @property {number} seconds - seconds (0-59)
     * @property {number} sleepQualityDurationMins - sleep quality duration in minutes (ether 1 or 5)
     * @property {Array<number>} sleepQuality - sleep quality, array of elements, each represents the quality for the duration of sleepQualityDurationMins
     */




    static #DATA_Service_UUID = '0000fff0-0000-1000-8000-00805f9b34fb'
    static #TX_Characteristic_UUID = '0000fff6-0000-1000-8000-00805f9b34fb'
    static #RX_Characteristic_UUID = '0000fff7-0000-1000-8000-00805f9b34fb'

    #replyCallbacks = {}
    // persistent callbacks for streamed data, keyed by command byte (not removed after one packet)
    #streamCallbacks = {}


    /**
     * Finds a device given a name prefix
     * @param {string} namePrefix - prefix of a name
     * @returns {Promise<JStyle2025>} one JStyle2025 instance
     */
    static async findjStyleByName (namePrefix) {
        let dev = await navigator.bluetooth.requestDevice({
            filters: [
                { namePrefix },
                { services: [JStyle2025.#DATA_Service_UUID] }
            ]
        })

        return new JStyle2025(dev)
    }

    /**
     * Creates a new jStyle instance
     * @param {Object} device - BLE device
     */
    constructor(device) {
        super(device)
    }


    /**
     * Connects to the jStyle
     * @param {Function} disconnectCallback - called when the device disconnects
     * @returns {PromiseLike} 
     */
    async connect (disconnectCallback) {
        await super.connect(disconnectCallback)

        return this.startNotifications(JStyle2025.#DATA_Service_UUID, JStyle2025.#RX_Characteristic_UUID, (event) => {
            const value = event.target.value
            // In Chrome 50+, a DataView is returned instead of an ArrayBuffer.
            const btvalues = value.buffer ? value : new DataView(value)
            if (btvalues.byteLength > 0) {
                let cmd = btvalues.getUint8(0)

                if (this.#replyCallbacks[cmd]) {
                    this.#replyCallbacks[cmd](btvalues)
                } else if (this.#streamCallbacks[cmd]) {
                    this.#streamCallbacks[cmd](btvalues)
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
        console.log('-> Sending command ' + command)
        let outData = new Uint8Array(16)
        // copy command
        outData[0] = command & 0xff

        let crc = 0
        for (let i = 0; i < outData.length - 1; i++) {
            // copy the data
            if ((data != null) && (i > 0) && (i <= data.byteLength)) {
                outData[i] = data.getUint8(i - 1)
            }
            crc += outData[i]
        }
        // add CRC
        outData[outData.length - 1] = crc & 0xff

        return super.writeCharacteristic(JStyle2025.#DATA_Service_UUID, JStyle2025.#TX_Characteristic_UUID, outData)
    }

    #fromNumAsHexToNumAsDec (num) {
        return parseInt(num.toString(16))
    }

    #fromNumAsDecToNumAsHex (num) {
        return parseInt('' + num, 16)
    }


    /**
     * Waits for a reply to a given command
     * @param {number} command - command to wait for, as a number (should fit within 1 byte)
     * @returns {Promise<DataView>} 
     */
    async #waitForReply (command) {
        return new Promise((resolve, reject) => {
            let timeoutId = setTimeout(() => {
                // time out no reply !
                delete this.#replyCallbacks[command]
                console.error('timeout!')
                reject()
            }, 1000)
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
            console.log('Got device version reply ', btvalues)
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
            console.log('Got device battery reply ', btvalues)
            let level = btvalues.getUint8(1)
            return level
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.getBatteryLevel)
        return replyPromise
    }

    /**
     * Gets the device name
     * @returns {Promise<string>} - device name
     */
    async getName () {
        let replyPromise = this.#waitForReply(CMDS.getName).then((btvalues) => {
            console.log('Got device name reply ', btvalues)
            const decoder = new TextDecoder('utf8')
            const nameDV = new DataView(btvalues.buffer, 1, 15)
            const name = decoder.decode(nameDV).replace(/\0/g, '') // remove null characters
            return name
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.getName)
        return replyPromise
    }

    /**
     * Gets the device MAC address
     * @returns {Promise<string>} - Bluetooth MAC address in format XX:XX:XX:XX:XX:XX
     */
    async getMACAddress () {
        let replyPromise = this.#waitForReply(CMDS.getMACAddress).then((btvalues) => {
            console.log('Got device MAC address reply ', btvalues)
            let macAddress = ''
            for (let i = 1; i < 7; i++) {
                macAddress += ('0' + btvalues.getUint8(i).toString(16)).slice(-2).toUpperCase()
                if (i < 6) {
                    macAddress += ':'
                }
            }
            return macAddress
        })
        await this.#sendCommand(CMDS.getMACAddress)
        return replyPromise
    }



    /**
     * Gets the device time
     * @returns {Promise<DeviceTime>}
     */
    async getTime () {
        let replyPromise = this.#waitForReply(CMDS.getTime).then((btvalues) => {
            console.log('Got device time reply ', btvalues)
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
     * @returns {Promise<void>}
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
            console.log('Got device time set OK ', btvalues)
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
            console.log('Got user profile', btvalues)
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
            console.log('Got user profile set OK ', btvalues)
            return
        })
        // first we send the command, then we wait
        await this.#sendCommand(CMDS.setUserProfile, userProfileDV)
        return replyPromise
    }

    /**
     * Sets automatic data collection mode
     * @param {number} startHour - hour to start automatic data collection (0-23)
     * @param {number} startMinute - minute to start automatic data collection (0-59)
     * @param {number} stopHour - hour to stop automatic data collection (0-23)
     * @param {number} stopMinute - minute to stop automatic data collection (0-59)
     * @param {number} intervalMinutes - interval in minutes for automatic data collection, default is 15 minutes
     * @param {number} type - type of automatic data collection, 1=AutoHeartRate, 2=AutoSpo2, 3=AutoTemp, 4=AutoHrv
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async setAutoMode (startHour, startMinute, stopHour, stopMinute, intervalMinutes = 15, type = 1) {

        if (intervalMinutes < 1 || intervalMinutes > 60) {
            throw new Error('Interval minutes must be between 1 and 60')
        }
        if (type < 1 || type > 4) {
            throw new Error('Type must be between 1 and 4')
        }
        const buffer = new ArrayBuffer(9)
        const automodeDV = new DataView(buffer)


        automodeDV.setUint8(0, 0x02) // open = true
        automodeDV.setUint8(1, this.#fromNumAsDecToNumAsHex(startHour))
        automodeDV.setUint8(2, this.#fromNumAsDecToNumAsHex(startMinute))
        automodeDV.setUint8(3, this.#fromNumAsDecToNumAsHex(stopHour))
        automodeDV.setUint8(4, this.#fromNumAsDecToNumAsHex(stopMinute))
        automodeDV.setUint8(5, 255) // week days, 255 means all days
        automodeDV.setUint16(6, intervalMinutes, true) // time in minutes, little endian
        automodeDV.setUint8(8, type) // type: 1=AutoHeartRate, 2=AutoSpo2, 3=AutoTemp, 4=AutoHrv

        let replyPromise = this.#waitForReply(CMDS.setAutoMode).then((btvalues) => {
            console.log('Got automode set OK ', btvalues)
            return
        })
        await this.#sendCommand(CMDS.setAutoMode, automodeDV)
        return replyPromise
    }

    /**
     * Gets the automatic data collection mode
     * @param {mode} type - type of automatic data collection, 1=AutoHeartRate, 2=AutoSpo2, 3=AutoTemp, 4=AutoHrv
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async getAutoMode (type) {
        if (type < 1 || type > 4) {
            throw new Error('Type must be between 1 and 4')
        }
        let replyPromise = this.#waitForReply(CMDS.getAutoMode).then((btvalues) => {
            if (btvalues.getUint8(0) === CMDS.getAutoMode) {
                console.log('Got automode reply ', btvalues)
                let enabled = btvalues.getUint8(1)
                let startHour = this.#fromNumAsHexToNumAsDec(btvalues.getUint8(2)) // start hour
                let startMinutes = this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)) // start minutes
                let stopHour = this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)) // stop hour
                let stopMinutes = this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)) // stop minutes
                // Reverse order of the bits (LSB first) and only includes 7 bits
                // 00000101 gives 1-0-1-0-0-0-0
                // last bit is Monday, second last bit is Tuesday, etc.
                // supposing that Monday is the first day of the week !
                let weekDays = {
                    monday: btvalues.getUint8(6) & 0x01,
                    tuesday: btvalues.getUint8(6) >> 1 & 0x01,
                    wednesday: btvalues.getUint8(6) >> 2 & 0x01,
                    thursday: btvalues.getUint8(6) >> 3 & 0x01,
                    friday: btvalues.getUint8(6) >> 4 & 0x01,
                    saturday: btvalues.getUint8(6) >> 5 & 0x01,
                    sunday: btvalues.getUint8(6) >> 6 & 0x01
                }
                let intervalMinutes = btvalues.getUint16(7, true) // interval in minutes

                return { enabled, startHour, startMinutes, stopHour, stopMinutes, weekDays, intervalMinutes }
            } else {
                throw new Error('Unexpected command ' + btvalues.getUint8(0) + ' received when querying automatic mode')
            }
        })

        const buffer = new ArrayBuffer(1)
        const automodeDV = new DataView(buffer)
        automodeDV.setUint8(0, type) // type: 1=AutoHeartRate, 2=AutoSpo2, 3=AutoTemp, 4=AutoHrv
        await this.#sendCommand(CMDS.getAutoMode, automodeDV)
        return replyPromise
    }


    /**
    * Clears data from watch
    */
    async clearData () {
        let replyPromise = this.#waitForReply(CMDS.clearData).then((btvalues) => {
            console.log('Got clear data OK ', btvalues)
            return
        })
        await this.#sendCommand(CMDS.clearData)
        return replyPromise
    }

    /**
    * Queries activity summary data, one summary record per day
    * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
    * @returns {Promise<Array<DailyActivitySummary>>} - array of activity records, each record is an object with year, month, day, steps, time, distance and calories
    */
    async getDailyActivitySummaryHistory (fromDate) {
        /**
         * @type {Array<DailyActivitySummary>}
         */
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

        let recordsBurstSent = 0

        let getOneRecord = async (btvalues) => {
            console.log('Got activity history data')
            recordsBurstSent++
            let shouldFinish = false

            // records take either 26 or 27 bytes
            // additionally, an "end record" (record with just the end flag) takes only 2 bytes
            let recordSize = 27
            const packetLen = btvalues.byteLength
            if (packetLen >= 26) {
                if (packetLen % 26 == 0) {
                    recordSize = 26
                } else if (packetLen % 27 == 0) {
                    recordSize = 27
                } else {
                    // cases where the packet size is not mulitple of 27 or 26 bytes
                    // the packet may contain an extra "end record"
                    if ((packetLen - 2) % 26 == 0) {
                        recordSize = 26
                    } else if ((packetLen - 2) % 27 == 0) {
                        recordSize = 27
                    } else {
                        console.warn('Packet size is ' + packetLen + ', strange! Let\'s finish it here')
                        // packet size is strange, let's finish acquisition
                        shouldFinish = true
                    }
                }
                // get the number of records in this packet
                const nRecords = Math.floor(packetLen / recordSize)
                console.log('records in this packet: ' + nRecords, 'record size: ' + recordSize)
                if (nRecords == 0) {
                    console.warn('No records in this packet, but we got some data, maybe the packet is not well formed?')
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
                        // bytes 9-12 = exercise minutes
                        // bytes 13-16 = distance (x 100)
                        // bytes 17-20 = calories (x 100)
                        // bytes 21-(22) = goal (only byte 21 if count is 26, else bytes 21-22)
                        // bytes 22-26 (23-26) = active minutes

                        if (btvalues.getUint8(i * recordSize) == CMDS.getDailyActivitySummaryHistory) {
                            let recordCount = btvalues.getUint8(1 + i * recordSize)

                            let flag = 1 + (i + 1) * recordSize;
                            if (flag < packetLen && btvalues.getUint8(flag) === 0xff) {
                                console.log('Got end record, will finish acquisition')
                                // no more data
                                shouldFinish = true
                            }

                            let goal = 0
                            if (recordSize == 26) {
                                goal = btvalues.getUint8(21 + i * recordSize, true)

                            } else {
                                goal = btvalues.getUint8(21 + i * recordSize) + (btvalues.getUint8(22 + i * recordSize) << 8)
                            }
                            /**
                             * @type {DailyActivitySummary}
                             */
                            let activityRecord = {
                                recordCount: recordCount,
                                year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(2 + i * recordSize)),
                                month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3 + i * recordSize)),
                                day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4 + i * recordSize)),
                                steps: btvalues.getUint32(5 + i * recordSize, true), // 32 bits u integer, little endian
                                exerciseMinutes: btvalues.getUint32(9 + i * recordSize, true),
                                distance: btvalues.getUint32(13 + i * recordSize, true) / 100,
                                calories: btvalues.getUint32(17 + i * recordSize, true) / 100,
                                goal: goal,
                                activeMinutes: btvalues.getUint32((recordSize - 4) + i * recordSize, true) // this may be exercise time, not sure
                            }
                            console.log('activity sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day, activityRecord)
                            activityHistory.push(activityRecord)
                        } else {
                            console.error('Got unexpected command ' + btvalues.getUint8(i * recordSize) + ' in activity history')
                            // shouldn't happen, maybe the recordsize is not well estimated?
                        }

                    }
                    // if there is any record left
                    console.log('Bytes left after records: ' + (packetLen - nRecords * recordSize))
                    if (packetLen >= (nRecords * recordSize) + 2) {
                        // maybe there's the end record?
                        if (btvalues.getUint8(nRecords * recordSize) == CMDS.getDailyActivitySummaryHistory) {
                            console.log('first byte is activity history command, checking for end record')
                            if (btvalues.getUint8((nRecords * recordSize) + 1) == 0xff) {
                                console.log('Second byte is end record, no more activity records')
                                shouldFinish = true
                            }
                        }
                    }
                }
            } else {
                console.log('Packet length is too short, got ' + packetLen + ', likely an end record?')
                // not enough data just signal that it's finished
                shouldFinish = true
            }

            if (shouldFinish) {
                console.log('No more activity records, return data')
                // no need to get more records, return the ones we have so far
                return activityHistory
            } else {
                console.log('More activity records, getting next one')
                // get next record, repeat
                // wait for the next packet to arrive:
                let replyPromise = this.#waitForReply(CMDS.getDailyActivitySummaryHistory).then(getOneRecord)

                if (recordsBurstSent >= 50) {
                    recordsBurstSent = 0
                    // send a continue message
                    historyConfigDV.setUint8(0, 2) // mode: 0=start, 2=continue, 0x99=delete
                    this.#sendCommand(CMDS.getDailyActivitySummaryHistory, historyConfigDV)
                }

                return replyPromise
            }
        }
        let replyPromise = this.#waitForReply(CMDS.getDailyActivitySummaryHistory).then(getOneRecord)

        await this.#sendCommand(CMDS.getDailyActivitySummaryHistory, historyConfigDV)
        return replyPromise
    }

    /**
     * Deletes daily activity summary history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteDailyActivitySummaryHistory (fromDate) {
        let replyPromise = this.#waitForReply(CMDS.getDailyActivitySummaryHistory).then((btvalues) => {
            console.log('Daily activity summary history deleted', btvalues)
            return
        })

        let historyConfigDV = new DataView(new ArrayBuffer(6))
        historyConfigDV.setUint8(0, 0x99) // mode: 0=start, 2=continue, 0x99=delete

        if (fromDate) {
            let yearPost2k = fromDate.getFullYear() - 2000
            historyConfigDV.setUint8(3, this.#fromNumAsDecToNumAsHex(yearPost2k))

            let monthFrom1 = fromDate.getMonth() + 1
            historyConfigDV.setUint8(4, this.#fromNumAsDecToNumAsHex(monthFrom1))

            let day = fromDate.getDate()
            historyConfigDV.setUint8(5, this.#fromNumAsDecToNumAsHex(day))
        }

        await this.#sendCommand(CMDS.getDailyActivitySummaryHistory, historyConfigDV)
        return replyPromise
    }


    /**
    * Queries sleep data
    * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
    * @returns {Promise<Array<Sleep>>} - array of activity records
    */
    async getSleepHistory (fromDate) {

        let sleepHistory = []

        let historyConfigDV = new DataView(new ArrayBuffer(9))
        historyConfigDV.setUint8(0, 0) // mode: 0=start, 2=continue, 0x99=delete

        if (fromDate) {
            let yearPost2k = fromDate.getFullYear() - 2000
            historyConfigDV.setUint8(3, this.#fromNumAsDecToNumAsHex(yearPost2k))

            let monthFrom1 = fromDate.getMonth() + 1
            historyConfigDV.setUint8(4, this.#fromNumAsDecToNumAsHex(monthFrom1))

            let day = fromDate.getDate()
            historyConfigDV.setUint8(5, this.#fromNumAsDecToNumAsHex(day))

            let hour = fromDate.getHours()
            historyConfigDV.setUint8(6, this.#fromNumAsDecToNumAsHex(hour))

            let minutes = fromDate.getMinutes()
            historyConfigDV.setUint8(7, this.#fromNumAsDecToNumAsHex(minutes))

            let seconds = fromDate.getSeconds()
            historyConfigDV.setUint8(8, this.#fromNumAsDecToNumAsHex(seconds))
        }

        let packetsSent = 0

        /**
         * Decode Binary - Coded Decimal (BCD) value  
         * this function takes a byte where each nibble (4 bits) represents a decimal digit (0-9) and converts it 
         * into a two-character string representing those two digits  
         * @param {number} byte 
         * @returns {number} - the decoded decimal value
         */
        const decodeBCD = (byte) => {
            let firstDigit = (byte & 0xf0) >>> 4
            let secondDigit = byte & 0x0f
            return firstDigit * 10 + secondDigit
        }

        let getOneRecord = async (btvalues) => {
            console.log('Got activity history data')
            packetsSent++
            let shouldFinish = (btvalues.getUint8(btvalues.byteLength - 1) == 0xff) && (btvalues.getUint8(btvalues.byteLength - 2) == CMDS.getSleeepHistory)

            if (btvalues.byteLength === 130 || (shouldFinish && 132 == length)) {
                // One minute sleep data

                if (btvalues.getUint8(0) == CMDS.getSleeepHistory) {
                    let sleepLength = btvalues.getUint8(9)
                    let sleepMinutes = []
                    for (let i = 0; i < sleepLength; i++) {
                        sleepMinutes.push(btvalues.getUint8(10 + i))
                    }

                    let sleepRecord = {
                        year: 2000 + decodeBCD(btvalues.getUint8(3)),
                        month: decodeBCD(btvalues.getUint8(4)),
                        day: decodeBCD(btvalues.getUint8(5)),
                        hour: decodeBCD(btvalues.getUint8(6)),
                        minutes: decodeBCD(btvalues.getUint8(7)),
                        seconds: decodeBCD(btvalues.getUint8(8)),
                        sleepQualityDurationMins: 1,
                        sleepQuality: sleepMinutes
                    }

                    sleepHistory.push(sleepRecord)
                    console.log('Sleep record: ', sleepRecord)
                } else {
                    console.error('Got unexpected command ' + btvalues.getUint8(0) + ' in sleep history')
                    // maybe finish?
                }
            } else {
                const recordSize = 34
                const packetLen = btvalues.byteLength

                if (packetLen >= 34) {
                    // get the number of records in this packet
                    const nRecords = Math.floor(packetLen / recordSize)
                    console.log('records in this packet: ' + nRecords, 'record size: ' + recordSize)
                    if (nRecords == 0) {
                        console.warn('No records in this packet, but we got some data, maybe the packet is not well formed?')
                        // no more data is expected to arrive
                        shouldFinish = true
                    } else {
                        for (let i = 0; i < nRecords; i++) {
                            // structure of an activity record:
                            // byte 0 =  command
                            // byte 1 = 
                            // byte 2 = 
                            // byte 3 = year (minus 2000)
                            // byte 4 = month
                            // byte 5 = day of month
                            // byte 6 = hour
                            // byte 7 = minutes
                            // byte 8 = seconds
                            // byte 9 = sleep length in 5 minutes
                            // bytes 10-34 = sleep details, each byte is a 5 minute period

                            let sleepLength = btvalues.getUint8(9 + i * recordSize)
                            let sleep5Minutes = []
                            for (let j = 0; j < sleepLength; j++) {
                                sleep5Minutes.push(btvalues.getUint8(10 + j + i * recordSize))
                            }


                            let sleepRecord = {
                                year: 2000 + decodeBCD(btvalues.getUint8(3 + i * recordSize)),
                                month: decodeBCD(btvalues.getUint8(4 + i * recordSize)),
                                day: decodeBCD(btvalues.getUint8(5 + i * recordSize)),
                                hour: decodeBCD(btvalues.getUint8(6 + i * recordSize)),
                                minutes: decodeBCD(btvalues.getUint8(7 + i * recordSize)),
                                seconds: decodeBCD(btvalues.getUint8(8 + i * recordSize)),
                                sleepQualityDurationMins: 5,
                                sleepQuality: sleep5Minutes
                            }

                            sleepHistory.push(sleepRecord)
                            console.log('Sleep record: ', sleepRecord)

                        }
                    }
                } else {
                    console.log('Packet length is too short, got ' + packetLen + ', likely an end record?')
                    // not enough data just signal that it's finished
                    shouldFinish = true
                }

            }

            if (shouldFinish) {
                console.log('No more sleep records, return data')
                // no need to get more records, return the ones we have so far
                return sleepHistory
            } else {
                console.log('More sleep records, getting next one')
                // get next record, repeat
                // wait for the next packet to arrive:
                let replyPromise = this.#waitForReply(CMDS.getSleeepHistory).then(getOneRecord)

                if (packetsSent >= 50) {
                    packetsSent = 0
                    // send a continue message
                    historyConfigDV.setUint8(0, 2) // mode: 0=start, 2=continue, 0x99=delete
                    this.#sendCommand(CMDS.getSleeepHistory, historyConfigDV)
                }

                return replyPromise
            }
        }
        let replyPromise = this.#waitForReply(CMDS.getSleeepHistory).then(getOneRecord)

        await this.#sendCommand(CMDS.getSleeepHistory, historyConfigDV)
        return replyPromise
    }

    /**
     * Deletes sleep history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteSleepHistory (fromDate) {
        let replyPromise = this.#waitForReply(CMDS.getSleeepHistory).then((btvalues) => {
            console.log('Sleep history deleted', btvalues)
            return
        })

        let historyConfigDV = new DataView(new ArrayBuffer(9))
        historyConfigDV.setUint8(0, 0x99) // mode: 0=start, 2=continue, 0x99=delete

        if (fromDate) {
            let yearPost2k = fromDate.getFullYear() - 2000
            historyConfigDV.setUint8(3, this.#fromNumAsDecToNumAsHex(yearPost2k))

            let monthFrom1 = fromDate.getMonth() + 1
            historyConfigDV.setUint8(4, this.#fromNumAsDecToNumAsHex(monthFrom1))

            let day = fromDate.getDate()
            historyConfigDV.setUint8(5, this.#fromNumAsDecToNumAsHex(day))

            let hour = fromDate.getHours()
            historyConfigDV.setUint8(6, this.#fromNumAsDecToNumAsHex(hour))

            let minutes = fromDate.getMinutes()
            historyConfigDV.setUint8(7, this.#fromNumAsDecToNumAsHex(minutes))

            let seconds = fromDate.getSeconds()
            historyConfigDV.setUint8(8, this.#fromNumAsDecToNumAsHex(seconds))
        }

        await this.#sendCommand(CMDS.getSleeepHistory, historyConfigDV)
        return replyPromise
    }

    /**
     * As all hisotory commands are similar, this function is used to get history data
     * @param {number} command - command to get history for, as a number (should fit within 1 byte)
     * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
     * @param {number} recordSize - size of the record in bytes
     * @param {Function} parseOneRecord - function to parse one record, should take a DataView as argument and return an object with the parsed data
     * @returns {Promise<Array>} - array of records, each record is an object with the parsed data
     */
    async #getHistory (command, fromDate, recordSize, parseOneRecord) {
        let history = []

        let historyConfigDV = new DataView(new ArrayBuffer(9))
        /**
         * mode:
         * 99: Delete step details,
         * 0: Read the most recent step details.
         * 2: Continue reading the next segment of data at the position last read
         */
        const mode = 0
        historyConfigDV.setUint8(0, mode)

        if (fromDate) {
            let yearPost2k = fromDate.getFullYear() - 2000
            historyConfigDV.setUint8(3, this.#fromNumAsDecToNumAsHex(yearPost2k))

            let monthFrom1 = fromDate.getMonth() + 1
            historyConfigDV.setUint8(4, this.#fromNumAsDecToNumAsHex(monthFrom1))

            let day = fromDate.getDate()
            historyConfigDV.setUint8(5, this.#fromNumAsDecToNumAsHex(day))

            let hour = fromDate.getHours()
            historyConfigDV.setUint8(6, this.#fromNumAsDecToNumAsHex(hour))

            let minutes = fromDate.getMinutes()
            historyConfigDV.setUint8(7, this.#fromNumAsDecToNumAsHex(minutes))

            let seconds = fromDate.getSeconds()
            historyConfigDV.setUint8(8, this.#fromNumAsDecToNumAsHex(seconds))
        }

        let recordsBurstSent = 0

        let getOneRecord = async (btvalues) => {
            console.log('Got history data', btvalues)
            recordsBurstSent++
            let shouldFinish = false

            const packetLen = btvalues.byteLength
            if (packetLen && (btvalues.getUint8(0) == command)) {
                if (btvalues.getUint8(packetLen - 1) == 0xff) {
                    // end of data is signalled by 0xff byte
                    shouldFinish = true
                }
                if (packetLen >= recordSize) {
                    // get the number of records in this packet
                    const nRecords = Math.floor(packetLen / recordSize)
                    console.log('records in this packet: ' + nRecords)
                    if (nRecords == 0) {
                        console.warn('No records in this packet, finish acquisition')
                        // no more data is expected to arrive
                        shouldFinish = true
                    } else {
                        for (let i = 0; i < nRecords; i++) {

                            if (btvalues.getUint8(i * recordSize) == command) {

                                let recordDV = new DataView(btvalues.buffer, i * recordSize, recordSize);
                                let parsedRecord = parseOneRecord(recordDV)

                                history.push(parsedRecord)
                            } else {
                                console.error('Got unexpected command ' + btvalues.getUint8(i * recordSize) + ' when querying for command ' + command)
                                // shouldn't happen, maybe the recordsize is not well estimated?
                                shouldFinish = true
                            }
                        }
                    }
                } else {
                    console.log('Packet length is too short, got ' + packetLen + ', likely an end record?')
                    // not enough data just signal that it's finished
                    shouldFinish = true
                }
            } else {
                console.error('Got unexpected command ' + btvalues.getUint8(0) + ' when querying for command ' + command)
                shouldFinish = true
            }

            if (shouldFinish) {
                console.log('No more records, return data')
                // no need to get more records, return the ones we have so far
                return history
            } else {
                console.log('More records, getting next one')
                // get next record, repeat
                // wait for the next packet to arrive:
                let replyPromise = this.#waitForReply(command).then(getOneRecord)

                if (recordsBurstSent >= 50) {
                    recordsBurstSent = 0
                    // send a continue message
                    historyConfigDV.setUint8(0, 2) // mode: 2=continue
                    this.#sendCommand(command, historyConfigDV)
                }

                return replyPromise
            }
        }
        let replyPromise = this.#waitForReply(command).then(getOneRecord)

        await this.#sendCommand(command, historyConfigDV)
        return replyPromise
    }

    /**
     * Generic function to delete history data from the watch
     * @param {number} command - command to delete history for, as a number (should fit within 1 byte)
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async #deleteHistory (command, fromDate) {
        let replyPromise = this.#waitForReply(command).then((btvalues) => {
            console.log('Detailed activity history deleted', btvalues)
            return
        })

        let historyConfigDV = new DataView(new ArrayBuffer(9))
        historyConfigDV.setUint8(0, 0x99) // mode: 0=start, 2=continue, 0x99=delete

        if (fromDate) {
            let yearPost2k = fromDate.getFullYear() - 2000
            historyConfigDV.setUint8(3, this.#fromNumAsDecToNumAsHex(yearPost2k))

            let monthFrom1 = fromDate.getMonth() + 1
            historyConfigDV.setUint8(4, this.#fromNumAsDecToNumAsHex(monthFrom1))

            let day = fromDate.getDate()
            historyConfigDV.setUint8(5, this.#fromNumAsDecToNumAsHex(day))

            let hour = fromDate.getHours()
            historyConfigDV.setUint8(6, this.#fromNumAsDecToNumAsHex(hour))

            let minutes = fromDate.getMinutes()
            historyConfigDV.setUint8(7, this.#fromNumAsDecToNumAsHex(minutes))

            let seconds = fromDate.getSeconds()
            historyConfigDV.setUint8(8, this.#fromNumAsDecToNumAsHex(seconds))
        }

        await this.#sendCommand(command, historyConfigDV)
        return replyPromise
    }


    /**
    * Queries detailed activity data
    * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
    * @returns {Promise<Array<DetailedActivity>} - array of activity records
    */
    async getDetailedActivityHistory (fromDate) {

        return this.#getHistory(
            CMDS.getDetailedActivityHistory,
            fromDate,
            25, // record size is 25 bytes
            (btvalues) => {
                // structure of an activity record:
                // byte 0 = command
                // byte 1 = record counter if 0xff = no more records (end record)
                // byte 2 = always 0 ?
                // byte 3 = year (minus 2000)
                // byte 4 = month
                // byte 5 = day of month
                // byte 6 = hour
                // byte 7 = minutes
                // byte 8 = seconds
                // bytes 9-10 = step count
                // bytes 11-12 = calories (x 100)
                // bytes 13-14 = distance (x 100)
                // bytes 15-24 = detail step, one uitn8 each, 10 bytes total

                let detailSteps = []
                for (let j = 0; j < 10; j++) {
                    detailSteps.push(btvalues.getUint8(15 + j))
                }
                /**
                 * @type {DetailedActivity}
                 */
                let activityRecord = {
                    recordCount: btvalues.getUint8(1),
                    year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                    month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                    day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                    hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                    minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(7)),
                    seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(8)),
                    steps: btvalues.getUint16(9, true), // 16 bits u integer, little endian
                    calories: btvalues.getUint16(11, true) / 100,
                    distance: btvalues.getUint16(13, true) / 100,
                    detailSteps: detailSteps
                }
                console.log('activity sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day + 'T' + activityRecord.hour + ':' + activityRecord.minutes + ':' + activityRecord.seconds, activityRecord)
                return activityRecord
            })
    }

    /**
     * Deletes detailed activity history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteDetailedActivityHistory (fromDate) {
        return this.#deleteHistory(CMDS.getDetailedActivityHistory, fromDate)
    }

    /**
     * Queries detailed heart rate history.
     * WARNING: this methods does not seem to work properly with the latest firmware version.
     * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
     * @returns {Promise<Array<DetailedHR>>} - array of heart rate records
     */
    async getDetailedHRHistory (fromDate) {

        return this.#getHistory(
            CMDS.getDetailedHRHistory,
            fromDate,
            24, // record size is 24 bytes
            (btvalues) => {
                // structure of a HR record:
                // byte 0 = command
                // byte 1 = record counter, it is reset after 255
                // byte 2 = ?
                // byte 3 = year (minus 2000)
                // byte 4 = month
                // byte 5 = day of month
                // byte 6 = hour
                // byte 7 = minutes
                // byte 8 = seconds
                // bytes 9-23 = heart rate data, one uint8 each, 15 bytes total

                let hrs = []
                for (let j = 0; j < 15; j++) {
                    hrs.push(btvalues.getUint8(9 + j))
                }
                /**
                 * @type {DetailedHR}
                 */
                let activityRecord = {
                    recordCount: btvalues.getUint8(1),
                    year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                    month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                    day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                    hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                    minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(7)),
                    seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(8)),
                    hrs: hrs
                }
                console.log('hrs sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day + 'T' + activityRecord.hour + ':' + activityRecord.minutes + ':' + activityRecord.seconds, activityRecord)

            })
    }

    /**
     * Deletes detailed HR history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteDetailedHRHistory (fromDate) {
        return this.#deleteHistory(CMDS.getDetailedHRHistory, fromDate)
    }

    /**
     * Gets the heart rate history
     * This is a simplified version of getDetailedHRHistory, which returns only the heart rate per sample
     * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
     * @returns {Promise<Array<HR>>} - array of heart rate records
     */
    async getHRHistory (fromDate) {

        return this.#getHistory(
            CMDS.getHRHistory,
            fromDate,
            10, // record size is 10 bytes
            (btvalues) => {
                // structure of a HR record:
                // byte 0 = command
                // byte 1 = record counter if 0xff = no more records (end record)
                // byte 2 = ?
                // byte 3 = year (minus 2000)
                // byte 4 = month
                // byte 5 = day of month
                // byte 6 = hour
                // byte 7 = minutes
                // byte 8 = seconds
                // bytes 9 = heart rate

                /**
                 * @type {HR}
                 */
                let activityRecord = {
                    recordCount: btvalues.getUint8(1),
                    year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                    month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                    day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                    hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                    minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(7)),
                    seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(8)),
                    hr: btvalues.getUint8(9)
                }
                console.log('hrs sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day + 'T' + activityRecord.hour + ':' + activityRecord.minutes + ':' + activityRecord.seconds, activityRecord)
                return activityRecord
            })
    }

    /**
    * Deletes HR history from the watch
    * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
    * @returns {Promise<void>} - resolves when the command is sent and reply is received
    */
    async deleteHRHistory (fromDate) {
        return this.#deleteHistory(CMDS.getHRHistory, fromDate)
    }

    /**
     
     * Gets the HRV history
     * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
     * @returns {Promise<Array<HRV>>} - array of HRV records
     */
    async getHRVHistory (fromDate) {
        return this.#getHistory(
            CMDS.getHRVHistory,
            fromDate,
            15, // record size is 15 bytes
            (btvalues) => {
                // structure of a HRV record:
                // byte 0 = command
                // byte 1 = record counter
                // byte 2 = ?
                // byte 3 = year (minus 2000)
                // byte 4 = month
                // byte 5 = day of month
                // byte 6 = hour
                // byte 7 = minutes
                // byte 8 = seconds
                // bytes 9 = HRV value
                // byte 10 = vascular age
                // byte 11 = heart rate
                // byte 12 = stress level
                // byte 13 = high BP
                // byte 14 = low BP

                /**
                 * @type {HRV}
                 */
                let activityRecord = {
                    recordCount: btvalues.getUint8(1),
                    year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                    month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                    day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                    hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                    minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(7)),
                    seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(8)),
                    hrv: btvalues.getUint8(9),
                    vascularAge: btvalues.getUint8(10),
                    hr: btvalues.getUint8(11),
                    stressLevel: btvalues.getUint8(12),
                    highBP: btvalues.getUint8(13),
                    lowBP: btvalues.getUint8(14)
                }
                console.log('hrv sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day + 'T' + activityRecord.hour + ':' + activityRecord.minutes + ':' + activityRecord.seconds, activityRecord)
                return activityRecord
            })
    }

    /**
     * Deletes HRV history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteHRVHistory (fromDate) {
        return this.#deleteHistory(CMDS.getHRVHistory, fromDate)
    }


    /**
     * Gets the temperature history
     * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
     * @returns {Promise<Array<Temperature>>} - array of temperature records
     */
    async getTemperatureHistory (fromDate) {
        return this.#getHistory(
            CMDS.getTemperatureHistory,
            fromDate,
            11,
            (btvalues) => {
                // structure of a temperature record:
                // byte 0 = command
                // byte 1 = record counter if 0xff = no more records (end record)
                // byte 2 = ?
                // byte 3 = year (minus 2000)
                // byte 4 = month
                // byte 5 = day of month
                // byte 6 = hour
                // byte 7 = minutes
                // byte 8 = seconds
                // bytes 9-10 = temperature in Celsius * 10, little endian

                /**
                 * @type {Temperature}
                 */
                let activityRecord = {
                    recordCount: btvalues.getUint8(1),
                    year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                    month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                    day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                    hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                    minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(7)),
                    seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(8)),
                    temperature: btvalues.getInt16(9, true) / 10
                }
                console.log('temperature sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day + 'T' + activityRecord.hour + ':' + activityRecord.minutes + ':' + activityRecord.seconds, activityRecord)
                return activityRecord
            })
    }

    /**
     * Deletes temperature history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteTemperatureHistory (fromDate) {
        return this.#deleteHistory(CMDS.getTemperatureHistory, fromDate)
    }


    /**
     * Gets the SPO2 history
     * @param {Date} fromDate - date from which to start querying, if not provided, queries all data
     * @returns {Promise<Array<SPO2>>} - array of SPO2 records
     */
    async getSPO2History (fromDate) {
        return this.#getHistory(
            CMDS.getSPO2History,
            fromDate,
            10,
            (btvalues) => {
                // structure of a SPO2 record:
                // byte 0 = command
                // byte 1 = record counter if 0xff = no more records (end record)
                // byte 2 = ?
                // byte 3 = year (minus 2000)
                // byte 4 = month
                // byte 5 = day of month
                // byte 6 = hour
                // byte 7 = minutes
                // byte 8 = seconds
                // bytes 9 = SPO2 value

                /**
                 * @type {SPO2}
                 */
                let activityRecord = {
                    recordCount: btvalues.getUint8(1),
                    year: 2000 + this.#fromNumAsHexToNumAsDec(btvalues.getUint8(3)),
                    month: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(4)),
                    day: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(5)),
                    hour: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(6)),
                    minutes: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(7)),
                    seconds: this.#fromNumAsHexToNumAsDec(btvalues.getUint8(8)),
                    spo2: btvalues.getUint8(9)
                }
                console.log('spo2 sample ' + activityRecord.year + '-' + activityRecord.month + '-' + activityRecord.day + 'T' + activityRecord.hour + ':' + activityRecord.minutes + ':' + activityRecord.seconds, activityRecord)
                return activityRecord
            })
    }

    /**
     * Deletes SPO2 history from the watch
     * @param {Date} fromDate - date from which to start deleting, if not provided, deletes all data
     * @returns {Promise<void>} - resolves when the command is sent and reply is received
     */
    async deleteSPO2History (fromDate) {
        return this.#deleteHistory(CMDS.getSPO2History, fromDate)
    }

    /**
     * @typedef {Object} ECGHR - periodic values sent by the watch during the ECG measurement
     * @property {number} hr - heart rate in bpm
     * @property {number} hrv - heart rate variability
     * @property {number} quality - signal quality
     */

    /**
     * @typedef {Object} ECGStatus - status packet sent by the watch during / at the end of the ECG measurement
     * @property {number} status - status code, only 3 (measurement completed, has results) is documented
     * @property {string} [date] - date of the measurement as YYYY-MM-DD hh:mm
     * @property {Object} [result] - measurement results, only when status is 3
     * @property {number} result.hrv - heart rate variability
     * @property {number} result.vascularAging - vascular age
     * @property {number} result.hr - heart rate in bpm
     * @property {number} result.fatigue - fatigue degree
     * @property {number} result.highBP - systolic blood pressure
     * @property {number} result.lowBP - diastolic blood pressure
     * @property {number} result.mood - mood value
     * @property {number} result.breath - breathing rate
     */

    /**
     * ECG sampling rate, as used by the iOS and Android SDK demos
     */
    static ECG_SAMPLE_RATE = 512

    /**
     * Parses a raw ECG packet, as done by the iOS SDK: big-endian signed int16 samples starting at byte 1
     * @param {DataView} btvalues - packet
     * @returns {Array<number>} samples, as sent by the watch
     */
    #parseECGSamples (btvalues) {
        const n = Math.floor((btvalues.byteLength - 1) / 2)
        const samples = new Array(Math.max(n, 0))
        for (let i = 0; i < n; i++) {
            samples[i] = btvalues.getInt16(1 + 2 * i, false)
        }
        return samples
    }

    /**
     * Parses an ECG status packet (0x9C)
     * @param {DataView} btvalues - packet
     * @returns {ECGStatus}
     */
    #parseECGStatus (btvalues) {
        const status = { status: btvalues.getUint8(1) }
        if (btvalues.byteLength >= 15) {
            // BCD encoded YY MM DD hh mm, byte 15 is the CRC (the Android SDK wrongly reads it as seconds)
            const bcd = (i) => btvalues.getUint8(i).toString(16).padStart(2, '0')
            status.date = '20' + bcd(10) + '-' + bcd(11) + '-' + bcd(12) + ' ' + bcd(13) + ':' + bcd(14)
        }
        if (status.status === 3) {
            status.result = {
                hrv: btvalues.getUint8(2),
                vascularAging: btvalues.getUint8(3),
                hr: btvalues.getUint8(4),
                fatigue: btvalues.getUint8(5),
                highBP: btvalues.getUint8(6),
                lowBP: btvalues.getUint8(7),
                mood: btvalues.getUint8(8),
                breath: btvalues.getUint8(9)
            }
        }
        return status
    }

    #removeECGStreamCallbacks () {
        delete this.#streamCallbacks[CMDS.ecgRaw]
        delete this.#streamCallbacks[CMDS.ecgHR]
        delete this.#streamCallbacks[CMDS.ecgStatus]
        delete this.#streamCallbacks[CMDS.stopECG]
    }

    /**
     * Starts the live ECG measurement, same command as the iOS SDK StartECGMode (0x99 with all zeros).
     * The measurement runs until stopECGStream() is called or the watch stops it.
     * @param {Object} callbacks
     * @param {Function} [callbacks.onECG] - called with an array of raw samples (as sent by the watch) for each packet
     * @param {Function} [callbacks.onHR] - called with an ECGHR object
     * @param {Function} [callbacks.onStatus] - called with an ECGStatus object
     * @param {Function} [callbacks.onEnd] - called when the watch stops the measurement by itself
     * @param {number} [callbacks.durationSec] - EXPERIMENTAL: duration written in bytes 3-4 (little endian), as the Android SDK
     *   OpenECGPPG does. The iOS SDK sends no duration; the watch records about 30 s of ECG and then sends the results (status 3).
     *   Not verified that the watch honours this value.
     * @returns {Promise<void>} - resolves when the command is sent and acknowledged
     */
    async startECGStream ({ onECG, onHR, onStatus, onEnd, durationSec } = {}) {
        let startDV = null
        if (durationSec) {
            if (!Number.isInteger(durationSec) || durationSec < 1 || durationSec > 0xffff) {
                throw new Error('Duration must be an integer between 1 and 65535 seconds')
            }
            // [0, 0, duration LSB, duration MSB]
            startDV = new DataView(new ArrayBuffer(4))
            startDV.setUint16(2, durationSec, true)
        }

        // register the stream handlers before starting, so that no packet is lost
        this.#streamCallbacks[CMDS.ecgRaw] = (btvalues) => {
            if (onECG) onECG(this.#parseECGSamples(btvalues))
        }
        this.#streamCallbacks[CMDS.ecgHR] = (btvalues) => {
            if (onHR) {
                onHR({
                    hr: btvalues.getUint8(1),
                    hrv: btvalues.getUint8(2),
                    quality: btvalues.getUint8(3)
                })
            }
        }
        this.#streamCallbacks[CMDS.ecgStatus] = (btvalues) => {
            if (onStatus) onStatus(this.#parseECGStatus(btvalues))
        }
        // stop received without asking for it: the watch ended the measurement
        this.#streamCallbacks[CMDS.stopECG] = () => {
            this.#removeECGStreamCallbacks()
            if (onEnd) onEnd()
        }

        let replyPromise = this.#waitForReply(CMDS.startECG)
        try {
            await this.#sendCommand(CMDS.startECG, startDV)
            await replyPromise
        } catch (err) {
            this.#removeECGStreamCallbacks()
            throw err || new Error('No reply to the ECG start command')
        }
    }

    /**
     * Stops the live ECG measurement (iOS SDK StopECGMode, 0x98 with all zeros)
     * @returns {Promise<void>} - resolves when the watch confirms (or after the reply timeout)
     */
    async stopECGStream () {
        let replyPromise = this.#waitForReply(CMDS.stopECG)
        try {
            await this.#sendCommand(CMDS.stopECG)
            await replyPromise
        } catch (err) {
            console.warn('No confirmation of the ECG stop command')
        } finally {
            this.#removeECGStreamCallbacks()
        }
    }


    /**
     * @typedef {Object} MeasurementData
     * @property {number} type - measurement type the packet refers to (1 = HRV, 2 = HR, 3 = SpO2)
     * @property {number} hr - heart rate (bpm)
     * @property {number} spo2 - blood oxygen (%)
     * @property {number} hrv - HRV
     * @property {number} stress - stress level
     * @property {number} highBP - systolic blood pressure
     * @property {number} lowBP - diastolic blood pressure
     * @property {boolean} completed - true when the watch has finished the measurement (only HRV ends by itself)
     * @property {string} raw - whole packet as hex, for debugging
     *
     * Observed behaviour (tests Nov 2026): the watch sends a packet about every second until stopped.
     * Bytes 5-7 (stress, BP) hold the results of the last HRV measurement and byte 4 (HRV) holds a stale or zero
     * value: none of them is updated by the HR and SpO2 measurements. In the HRV measurement byte 4 is 0 until the end; the last packet carries
     * the new HRV, stress and BP and then the watch stops sending (no other end message).
     * HR and SpO2 never end by themselves, and the stop command is not confirmed.
     */

    /**
     * Measurement types of the on-demand measurement (SDK StartDeviceMeasurementWithType)
     */
    static MEASUREMENT_TYPES = { HRV: 1, HR: 2, SPO2: 3 }

    /**
     * Parses a 0x28 packet, as done by the Android SDK for HR and SpO2 (the HRV parsing is commented out in the SDK,
     * the same layout is assumed)
     * While each measurement carries the same fields, fields are updated depending on the measurement mode.
     * For SPO2: Only HR and SPO2 are updated, at each packet.
     * For HR: Only HR is updated, at each packet.
     * For HRV: HR is updated at each packet, but HRV, stress and BP are only updated in the last packet.
     * @param {DataView} btvalues - packet
     * @returns {MeasurementData}
     */
    #parseMeasurement (btvalues) {
        const byte = (i) => (i < btvalues.byteLength ? btvalues.getUint8(i) : 0)
        const raw = []
        for (let i = 0; i < btvalues.byteLength; i++) raw.push(btvalues.getUint8(i).toString(16).padStart(2, '0'))
        return {
            type: byte(1),
            // The type of the measurement (1 = HRV, 2 = HR, 3 = SpO2)
            // HRV is 0 during the HRV measurement and set in its last packet
            completed: byte(1) === JStyle2025.MEASUREMENT_TYPES.HRV && byte(4) > 0,
            hr: byte(2),
            spo2: byte(3),
            hrv: byte(4),
            stress: byte(5),
            highBP: byte(6),
            lowBP: byte(7),
            raw: raw.join(' ')
        }
    }

    /**
     * Starts an on-demand measurement on the watch.
     * The watch measures by itself and reports values; the measurement runs until
     * stopMeasurement() is called or the watch ends it.
     * While each measurement carries the same fields, fields are updated depending on the measurement mode.
     * For SPO2: Only HR and SPO2 are updated, at each packet.
     * For HR: Only HR is updated, at each packet.
     * For HRV: HR is updated at each packet, but HRV, stress and BP are only updated in the last packet.
     * HRV measuerement ends by itself, while HR and SpO2 measurements must be stopped by the app.
     * Warning: in HR and SPO2, the watch may stop sending packets after a few seconds, even if the measurement is not stopped. The watch does not confirm the stop command.
     * @param {number} type - 1 = HRV, 2 = HR, 3 = SpO2 (see JStyle2025.MEASUREMENT_TYPES)
     * @param {Function} [onData] - called with a MeasurementData object for each 0x28 packet received from the watch
     * @returns {Promise<void>} - resolves when the command is sent
     */
    async startMeasurement (type, onData) {
        if (![1, 2, 3].includes(type)) throw new Error('Measurement type must be 1 (HRV), 2 (HR) or 3 (SpO2)')
        this.#streamCallbacks[CMDS.measurement] = (btvalues) => {
            const data = this.#parseMeasurement(btvalues)
            console.log('Measurement packet: ' + data.raw)
            if (onData) onData(data)
        }
        const dv = new DataView(new ArrayBuffer(2))
        dv.setUint8(0, type)
        dv.setUint8(1, 1)
        try {
            await this.#sendCommand(CMDS.measurement, dv)
        } catch (err) {
            delete this.#streamCallbacks[CMDS.measurement]
            throw err
        }
    }

    /**
     * Stops an on-demand measurement (0x28 [type, 0])
     * @param {number} type - 1 = HRV, 2 = HR, 3 = SpO2
     * The watch does not confirm the stop (tested on SpO2), so no reply is awaited.
     * @returns {Promise<void>} - resolves when the command is sent
     */
    async stopMeasurement (type) {
        const dv = new DataView(new ArrayBuffer(2))
        dv.setUint8(0, type)
        dv.setUint8(1, 0)
        // ignore packets still in flight when the stop is sent (one usually arrives after it)
        this.#streamCallbacks[CMDS.measurement] = () => { }
        await this.#sendCommand(CMDS.measurement, dv)
    }

}