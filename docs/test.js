import motion from './phone/motion.js'
import orientation from './phone/orientation.js'

import accelerometer from './phone/accelerometer.js'
import linearAccelerometer from './phone/linearAccelerometer.js'
import gyroscope from './phone/gyroscope.js'
import magnetometer from './phone/magnetometer.js'

import { HeartRateSensor } from './ble/heartratesensor.js'
import { RunningSpeedCadenceSensor } from './ble/rscsensor.js'
import { CyclingSpeedCadenceSensor } from './ble/cscsensor.js'

const connectRSCBtn = document.getElementById('connectRSCBtn')
const connectCSCBtn = document.getElementById('connectCSCBtn')
const connectHRBtn = document.getElementById('connectHRBtn')
const startButton = document.getElementById('startBtn')
const mainText = document.getElementById('mainText')
const subText = document.getElementById('subText')
const hrText = document.getElementById('hrText')
const rscText = document.getElementById('rscText')
const cscText = document.getElementById('cscText')
const testNameInput = document.getElementById('testNameInput')


// object containing the data of the test
let testData = {}
// initialization of an empty test data
const initData = function () {
    testData = {
        startTs: '',
        endTs: '',
        motion: [],
        accelerationG: [],
        acceleration: [],
        rotationRate: [],
        magneticField: [],
        orientation: [],
        heartRate: [],
        runningCadence: [],
        cyclingCadence: []
    }
}

const HRsensor = new HeartRateSensor('Polar', (meas) => {
    console.log(meas)
    hrText.textContent = "HR: " + meas.heartRate + " bpm"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.heartRate.push(meas)
    }
})

const RSCsensor = new RunningSpeedCadenceSensor('Polar', (meas) => {
    console.log(meas)
    rscText.textContent = "Running: " + meas.instantaneousCadence + " fpm"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.runningCadence.push(meas)
    }
})

const CSCsensor = new CyclingSpeedCadenceSensor('BK3', (meas) => {
    console.log(meas)
    cscText.textContent = "Cycling: " + meas.cumulativeCrankRevolutions + " cranks"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.cyclingCadence.push(meas)
    }
})

connectHRBtn.addEventListener('click', async () => {
    if (!HRsensor.isConnected()) {
        await HRsensor.connect()
        if (HRsensor.isConnected()) {
            HRsensor.startNotificationsHeartRateMeasurement()
            connectHRBtn.textContent = "Disconnect Heart Rate sensor"
        }
    } else {
        // HRsensor.stopNotificationsHeartRateMeasurement()
        HRsensor.disconnect()
        if (!HRsensor.isConnected()) {
            connectHRBtn.textContent = "Connect Heart Rate sensor"
            hrText.textContent = " "
        }
    }
})

connectRSCBtn.addEventListener('click', async () => {
    if (!RSCsensor.isConnected()) {
        await RSCsensor.connect()
        if (RSCsensor.isConnected()) {
            RSCsensor.startNotificationsRSCMeasurement()
            connectRSCBtn.textContent = "Disconnect Running sensor"
        }
    } else {
        // RSCsensor.stopNotificationsRSCMeasurement()
        RSCsensor.disconnect()
        if (!RSCsensor.isConnected()) {
            connectRSCBtn.textContent = "Connect Running sensor"
            rscText.textContent = " "
        }
    }
})

connectCSCBtn.addEventListener('click', async () => {
    if (!CSCsensor.isConnected()) {
        await CSCsensor.connect()
        if (CSCsensor.isConnected()) {
            CSCsensor.startNotificationsCSCMeasurement()
            connectCSCBtn.textContent = "Disconnect Cycling sensor"
        }
    } else {
        // RSCsensor.stopNotificationsRSCMeasurement()
        CSCsensor.disconnect()
        if (!CSCsensor.isConnected()) {
            connectCSCBtn.textContent = "Connect Cycling sensor"
            rscText.textContent = " "
        }
    }
})

let testRunning = false
mainText.textContent = 'Ready to start'
// Reference for the Wake Lock.
let wakeLock = null

let doTest = async function () {
    let useSensorsAPI = false
    if (!testRunning) {
        if (accelerometer.isAvailable()) {
            // looks like sensors API is available, let's use this instead of regular motion
            useSensorsAPI = true
            try {
                await accelerometer.requestPermission()
                if (linearAccelerometer.isAvailable()) await linearAccelerometer.requestPermission()
                if (gyroscope.isAvailable()) await gyroscope.requestPermission()
                if (magnetometer.isAvailable()) await magnetometer.requestPermission()
            } catch (err) {
                console.error(err)
                mainText.textContent = 'ERROR'
                subText.textContent = 'Sensor needs permission, retry'
                return
            }
        } else {
            try {
                await motion.requestPermission()
                await orientation.requestPermission()
            } catch (err) {
                console.error(err)
                mainText.textContent = 'ERROR'
                subText.textContent = 'Sensor needs permission, retry'
                return
            }
        }

        if ("wakeLock" in navigator) {
            // request a wake lock
            try {
                wakeLock = await navigator.wakeLock.request("screen")
            } catch (err) {
                console.errror(err)
            }
        } else {
            subText.textContent = "Wake lock is not supported by this browser"
        }

        // all permission working, start the test
        initData()
        testRunning = true
        testData.startTs = new Date()

        // start acquiring signals
        if (useSensorsAPI) {
            await accelerometer.startNotifications(60, (data) => {
                testData.accelerationG.push(data)
            })

            if (linearAccelerometer.isAvailable()) {
                await linearAccelerometer.startNotifications(60, (data) => {
                    testData.acceleration.push(data)
                })
            }

            if (gyroscope.isAvailable()) {
                await gyroscope.startNotifications(60, (data) => {
                    testData.rotationRate.push(data)
                })
            }
            if (magnetometer.isAvailable()) {
                await magnetometer.startNotifications(60, (data) => {
                    testData.magneticField.push(data)
                })
            }
        } else {
            motion.startNotifications((data) => {
                testData.motion.push(data)
            })
            orientation.startNotifications((data) => {
                testData.orientation.push(data)
            })
        }

        mainText.textContent = 'Test started!'
        startButton.textContent = 'Stop'
    } else {
        // release wake lock
        if (wakeLock) {
            wakeLock.release().then(() => {
                wakeLock = null
            })
        }

        testRunning = false
        // stop signals acquisition
        motion.stopNotifications()
        orientation.stopNotifications()
        accelerometer.stopNotifications()
        linearAccelerometer.stopNotifications()
        gyroscope.stopNotifications()
        magnetometer.stopNotifications()

        testData.endTs = new Date()
        mainText.textContent = 'Test completed, ready to start again'
        startButton.textContent = 'Start'

        console.log(testData)
        var blob = new Blob([JSON.stringify(testData)], { type: "text/json;charset=utf-8" })

        let filename = 'testResults_' + testNameInput.value + '.json'
        saveAs(blob, filename)
    }
}



// detect file saving capability
try {
    new Blob
} catch (e) {
    console.error(e)
    subText.textContent = 'File saving not supported'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}

// detect motion availability
if (!motion.isAvailable()) {
    subText.textContent = 'Motion sensor not available'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}

// detect orientation availability
if (!orientation.isAvailable()) {
    subText.textContent = 'Orientation sensor not available'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}


startButton.addEventListener('click', doTest)