import motion from './phone/motion.js'
import orientation from './phone/orientation.js'
import geolocation from './phone/geolocation.js'

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
        orientation: [],
        heartRate: [],
        runningCadence: [],
        cyclingCadence: [],
        geolocation: []
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

let firstCSCrevolutions = -1

const CSCsensor = new CyclingSpeedCadenceSensor('BK3', (meas) => {
    console.log(meas)
    if (firstCSCrevolutions == -1) firstCSCrevolutions = meas.cumulativeCrankRevolutions

    let revs = meas.cumulativeCrankRevolutions - firstCSCrevolutions
    cscText.textContent = "Cycling: " + revs + " cranks"

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
    if (!testRunning) {
        try {
            await motion.requestPermission()
            await orientation.requestPermission()
            await geolocation.requestPermission()
        } catch (err) {
            console.error(err)
            mainText.textContent = 'ERROR'
            subText.textContent = 'Sensor needs permission, retry'
            return
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

        // reset csc revolutions counter
        firstCSCrevolutions = -1

        // start acquiring IMU signals
        motion.startNotifications((data) => {
            testData.motion.push(data)
        })
        orientation.startNotifications((data) => {
            testData.orientation.push(data)
        })
        geolocation.startNotifications(1000, (data) => {
            testData.geolocation.push(data)
        })

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
        geolocation.stopNotifications()

        testData.endTs = new Date()
        mainText.textContent = 'Test completed, ready to start again'
        startButton.textContent = 'Start'

        console.log(testData)

        const testName = testNameInput.value
        let filename = 'test' + testName + '_' + new Date().getTime() + '.txt'
        const file = new File([JSON.stringify(testData)], filename, {
            type: 'text/plain',
        })

        let message = {
            title: 'Test ' + testName + ' results',
            text: 'This file contains a test done on ' + new Date(),
            files: [file],
        }

        if (navigator.canShare(message)) {
            await navigator.share(message);
        } else {
            mainText.textContent = 'Cannot share file'
        }
    }
}



// detect file saving capability
const testfile = new File(['test'], "testresults.json", {
    type: "text/json",
})
if ((typeof navigator.share !== 'function') || !navigator.canShare({
    title: "Test results",
    text: "This file contains a test done on " + new Date(),
    files: [testfile],
})) {
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