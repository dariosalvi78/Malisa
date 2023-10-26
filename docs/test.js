import motion from './phone/motion.js'
import orientation from './phone/orientation.js'
import { HeartRateSensor } from './ble/heartratesensor.js'
import { RunningSpeedCadenceSensor } from './ble/rscsensor.js'

let connectCadenceBtn = document.getElementById('connectCadenceBtn')
let connectHRBtn = document.getElementById('connectHRBtn')
let startButton = document.getElementById('startBtn')
let mainText = document.getElementById('mainText')
let subText = document.getElementById('subText')
let hrText = document.getElementById('hrText')
let rcsText = document.getElementById('rcsText')
let testNameInput = document.getElementById('testNameInput')


// object containing the data of the test
let testData = {}
// initialization of an empty test data
let initData = function () {
    testData = {
        startTs: '',
        endTs: '',
        motion: [],
        orientation: [],
        heartRate: [],
        cadence: []
    }
}

let HRsensor = new HeartRateSensor('Polar', (meas) => {
    console.log(meas)
    hrText.textContent = "HR: " + meas.heartRate + " bpm"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.heartRate.push(meas)
    }
})

let RSCsensor = new RunningSpeedCadenceSensor('Polar', (meas) => {
    console.log(meas)
    rcsText.textContent = "Cadence: " + meas.instantaneousCadence + " fpm"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.cadence.push(meas)
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

connectCadenceBtn.addEventListener('click', async () => {
    if (!RSCsensor.isConnected()) {
        await RSCsensor.connect()
        if (RSCsensor.isConnected()) {
            RSCsensor.startNotificationsRSCMeasurement()
            connectCadenceBtn.textContent = "Disconnect Cadence sensor"
        }
    } else {
        // RSCsensor.stopNotificationsRSCMeasurement()
        RSCsensor.disconnect()
        if (!RSCsensor.isConnected()) {
            connectCadenceBtn.textContent = "Connect Cadence sensor"
            rcsText.textContent = " "
        }
    }
})

let testRunning = false
mainText.textContent = 'Ready to start'

let doTest = async function () {
    if (!testRunning) {
        try {
            await motion.requestPermission()
        } catch (err) {
            console.error(err)
            mainText.textContent = 'ERROR'
            subText.textContent = 'Motion sensor needs permission, retry'
            return
        }

        try {
            await orientation.requestPermission()
        } catch (err) {
            console.error(err)
            mainText.textContent = 'ERROR'
            subText.textContent = 'Orientation sensor needs permission, retry'
            startButton.disabled = false
            return
        }

        // all permission working, start the test
        initData()
        testRunning = true
        testData.startTs = new Date()

        // start acquiring signals
        motion.startNotifications((data) => {
            testData.motion.push(data)
        })
        orientation.startNotifications((data) => {
            testData.orientation.push(data)
        })

        mainText.textContent = 'Test started!'
        startButton.textContent = 'Stop'
    } else {
        testRunning = false
        // stop signals acquisition
        motion.stopNotifications()
        orientation.stopNotifications()

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