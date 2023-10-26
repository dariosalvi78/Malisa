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
    hrText.innerHTML = "HR: " + meas.heartRate + " bpm"
    if (testData && testData.startTs) {
        meas.msFromStart = new Date().getTime() - testData.startTs.getTime()
    }
    if (testRunning) {
        testData.heartRate.push(meas)
    }
})

let RSCsensor = new RunningSpeedCadenceSensor('Polar', (meas) => {
    console.log(meas)
    rcsText.innerHTML = "Cadence: " + meas.instantaneousCadence + " fpm"
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
            connectHRBtn.innerHTML = "Disconnect Heart Rate sensor"
        }
    } else {
        // HRsensor.stopNotificationsHeartRateMeasurement()
        HRsensor.disconnect()
        if (!HRsensor.isConnected()) {
            connectHRBtn.innerHTML = "Connect Heart Rate sensor"
            hrText.innerHTML = " "
        }
    }
})

connectCadenceBtn.addEventListener('click', async () => {
    if (!RSCsensor.isConnected()) {
        await RSCsensor.connect()
        if (RSCsensor.isConnected()) {
            RSCsensor.startNotificationsRSCMeasurement()
            connectCadenceBtn.innerHTML = "Disconnect Cadence sensor"
        }
    } else {
        // RSCsensor.stopNotificationsRSCMeasurement()
        RSCsensor.disconnect()
        if (!RSCsensor.isConnected()) {
            connectCadenceBtn.innerHTML = "Connect Cadence sensor"
            rcsText.innerHTML = " "
        }
    }
})

let testRunning = false
mainText.innerHTML = 'Ready to start'

let doTest = async function () {
    if (!testRunning) {
        try {
            await motion.requestPermission()
        } catch (err) {
            console.error(err)
            mainText.innerHTML = 'ERROR'
            subText.innerHTML = 'Motion sensor needs permission, retry'
            return
        }

        try {
            await orientation.requestPermission()
        } catch (err) {
            console.error(err)
            mainText.innerHTML = 'ERROR'
            subText.innerHTML = 'Orientation sensor needs permission, retry'
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

        mainText.innerHTML = 'Test started!'
        startButton.innerHTML = 'Stop'
    } else {
        testRunning = false
        // stop signals acquisition
        motion.stopNotifications()
        orientation.stopNotifications()

        testData.endTs = new Date()
        mainText.innerHTML = 'Test completed, ready to start again'
        startButton.innerHTML = 'Start'

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
    subText.innerHTML = 'File saving not supported'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}

// detect motion availability
if (!motion.isAvailable()) {
    subText.innerHTML = 'Motion sensor not available'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}

// detect orientation availability
if (!orientation.isAvailable()) {
    subText.innerHTML = 'Orientation sensor not available'
    startButton.style.visibility = 'hidden'
    startButton.disabled = true
}


startButton.addEventListener('click', doTest)