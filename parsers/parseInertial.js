import { promises as fs } from 'fs'

if (process.argv.length !== 4) {
    console.error('Expected subject folder to parse and output folder')
    process.exit(1)
}

console.log('Parsing ' + process.argv[2])

async function deleteFileIfExists (filePath) {
    try {
        const stats = await fs.stat(filePath)
        if (stats.isFile()) {
            await fs.unlink(filePath)
        }
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('Error deleting file:', err)
        }
    }
}


async function createFolderIfNotExists (folderName) {
    try {
        await fs.mkdir(folderName)
    } catch (error) {
        if (error.code !== 'EEXIST') {
            throw error
        }
    }
}

let subjectFolder = process.argv[2]
let outputFolder = process.argv[3]

// create subfolder for CSVs
await createFolderIfNotExists(outputFolder)


let startEnds = await getHandStartEnds(subjectFolder)

console.log(startEnds)

let subjectSubFolders = await fs.readdir(subjectFolder)

for (let i = 0; i < subjectSubFolders.length; i++) {
    let subjectSubFolder = subjectSubFolders[i]
    if (subjectSubFolder == 'hand' || subjectSubFolder == 'back') {
        let resultFiles = await fs.readdir(subjectFolder + '/' + subjectSubFolder)
        for (let j = 0; j < resultFiles.length; j++) {
            let fileName = resultFiles[j]
            if (fileName.toLowerCase().endsWith('.json')) {
                let testNumber = fileName.toLowerCase().substr(-7, 2)
                await parsePhoneResults(subjectFolder + '/' + subjectSubFolder + '/' + fileName, outputFolder, testNumber, subjectSubFolder)
            }
        }
    }
    if (subjectSubFolder == 'bangle') {
        let resultFiles = await fs.readdir(subjectFolder + '/' + subjectSubFolder)
        for (let j = 0; j < resultFiles.length; j++) {
            let fileName = resultFiles[j]
            if (fileName.toLowerCase().endsWith('.json')) {
                let testNumber = fileName.toLowerCase().substr(-7, 2)
                await parseBangleResults(subjectFolder + '/' + subjectSubFolder + '/' + fileName, outputFolder, testNumber, subjectSubFolder)
            }
        }
    }
}

async function getHandStartEnds (subjectFolder) {
    let subjectSubFolders = await fs.readdir(subjectFolder)

    let startEnds = {}
    for (let i = 0; i < subjectSubFolders.length; i++) {
        let subjectSubFolder = subjectSubFolders[i]
        if (subjectSubFolder == 'hand') {
            let resultFiles = await fs.readdir(subjectFolder + '/' + subjectSubFolder)
            for (let j = 0; j < resultFiles.length; j++) {
                let fileName = resultFiles[j]
                if (fileName.toLowerCase().endsWith('.json')) {
                    let testNumber = fileName.toLowerCase().substr(-7, 2)
                    const txt = await fs.readFile(subjectFolder + '/' + subjectSubFolder + '/' + fileName)
                    const data = JSON.parse(txt)
                    startEnds[testNumber] = {
                        start: new Date(data.startTs),
                        end: new Date(data.endTs),
                    }
                }
            }
        }
    }

    return startEnds
}

async function parseBangleResults (filePath, outFolder, testNumber, sensorSuffix) {
    await createFolderIfNotExists(outFolder + '/' + testNumber)

    let filePathPre = outFolder + '/' + testNumber + '/' + sensorSuffix + '_'

    const txt = await fs.readFile(filePath)
    const data = JSON.parse(txt)

    let handStartEnd = startEnds[testNumber]
    let thisStartTS = new Date(data.startTs)
    let firstTS = new Date(handStartEnd.start.getTime() - 2000)
    let lastTS = new Date(handStartEnd.end.getTime() + 2000)

    let accelFilePath = filePathPre + 'accel.csv'
    await deleteFileIfExists(accelFilePath)
    let fd = await fs.open(accelFilePath, 'a')

    let textLine = 'time,accX,accY,accZ\n'
    await fd.write(textLine)

    let isTimeOK = false

    for (let mot of data.accel) {
        // discard initial samples with long timestamps
        if (!isTimeOK) {
            if (mot.ms < 1000) isTimeOK = true
        }
        if (isTimeOK) {

            let ts = new Date(thisStartTS.getTime() + mot.ms)
            if (ts > firstTS && ts < lastTS) {
                let row = '' +
                    ts.toISOString() + ',' +
                    mot.x + ',' +
                    mot.y + ',' +
                    mot.z

                await fd.write(row + '\n')
            }
        }
    }
    fd.close()

    let compassFilePath = filePathPre + 'compass.csv'
    await deleteFileIfExists(compassFilePath)
    fd = await fs.open(compassFilePath, 'a')

    textLine = 'time,accX,accY,accZ\n'
    await fd.write(textLine)

    isTimeOK = false

    for (let mot of data.compass) {
        // discard initial samples with long timestamps
        if (!isTimeOK) {
            if (mot.ms < 1000) isTimeOK = true
        }
        if (isTimeOK) {
            let ts = new Date(thisStartTS.getTime() + mot.ms)
            if (ts > firstTS && ts < lastTS) {
                let row = '' +
                    ts.toISOString() + ',' +
                    mot.x + ',' +
                    mot.y + ',' +
                    mot.z

                await fd.write(row + '\n')
            }
        }
    }
    fd.close()
}


async function parsePhoneResults (filePath, outFolder, testNumber, sensorSuffix) {

    let handStartEnd = startEnds[testNumber]

    await createFolderIfNotExists(outFolder + '/' + testNumber)

    let filePath = outFolder + '/' + testNumber + '/'

    const txt = await fs.readFile(filePath)
    const data = JSON.parse(txt)


    let motionFilePath = filePath + sensorSuffix + '_' + 'motion.csv'
    await deleteFileIfExists(motionFilePath)
    let fd = await fs.open(motionFilePath, 'a')

    let thisStartTS = new Date(data.startTs)
    let thisEndTS = new Date(data.endTs)
    let firstTS = new Date(handStartEnd.start.getTime() - 2000)
    let lastTS = new Date(handStartEnd.end.getTime() + 2000)

    let textLine = 'time,accX,accY,accZ,accGX,accGY,accGZ,rotAlpa,rotBeta,rotGamma\n'
    await fd.write(textLine)

    for (let mot of data.motion) {

        let ts = new Date(thisStartTS.getTime() + mot.msFromStart)

        if (ts > firstTS && ts < lastTS) {
            let row = '' +
                ts.toISOString() + ',' +
                mot.acc.x + ',' +
                mot.acc.y + ',' +
                mot.acc.z + ',' +
                mot.accG.x + ',' +
                mot.accG.y + ',' +
                mot.accG.z + ',' +
                mot.rotRate.alpha + ',' +
                mot.rotRate.beta + ',' +
                mot.rotRate.gamma

            await fd.write(row + '\n')
        }
    }
    fd.close()

    let orientFilePath = filePath + sensorSuffix + '_' + 'orientation.csv'

    await deleteFileIfExists(orientFilePath)
    fd = await fs.open(orientFilePath, 'a')

    textLine = 'time,alpha,beta,gamma,heading,accuracy\n'
    await fd.write(textLine)

    for (let orie of data.orientation) {

        let ts = new Date(thisStartTS.getTime() + orie.msFromStart)

        if (ts > firstTS && ts < lastTS) {
            let row = '' +
                ts.toISOString() + ',' +
                orie.alpha + ',' +
                orie.beta + ',' +
                orie.gamma + ','

            if (orie.heading) row += orie.heading
            row += ','
            if (orie.acc) row += orie.acc

            await fd.write(row + '\n')
        }
    }
    fd.close()

    if (data.heartRate && data.heartRate.length > 0) {
        let hrFilePath = filePath + 'hr.csv'

        await deleteFileIfExists(hrFilePath)
        fd = await fs.open(hrFilePath, 'a')

        textLine = 'time,heartRate,contactDetected,energyExpended,rrIntervals\n'
        await fd.write(textLine)

        for (let hrm of data.heartRate) {

            let ts = new Date(thisStartTS.getTime() + hrm.msFromStart)

            if (ts > firstTS && ts < lastTS) {
                let row = '' +
                    ts.toISOString() + ',' +
                    hrm.heartRate + ',' +
                    hrm.contactDetected + ','
                if (hrm.energyExpended) row += hrm.energyExpended
                row += ','
                if (hrm.rrIntervals) row += hrm.rrIntervals

                await fd.write(row + '\n')
            }
        }
        fd.close()
    }

    if (data.cadence && data.cadence.length > 0) {
        let rscFilePath = filePath + 'cadence.csv'

        await deleteFileIfExists(rscFilePath)
        fd = await fs.open(rscFilePath, 'a')

        textLine = 'time,isRunning,instantaneousSpeed,instantaneousCadence,instantaneousStrideLength,totalDistance\n'
        await fd.write(textLine)

        for (let rsc of data.cadence) {

            let ts = new Date(thisStartTS.getTime() + rsc.msFromStart)

            if (ts > firstTS && ts < lastTS) {
                let row = '' +
                    ts.toISOString() + ',' +
                    rsc.isRunning + ',' +
                    rsc.instantaneousSpeed + ',' +
                    rsc.instantaneousCadence + ','
                if (rsc.instantaneousStrideLength) row += rsc.instantaneousStrideLength
                row += ','
                if (rsc.totalDistance) row += rsc.totalDistance

                await fd.write(row + '\n')
            }
        }
        fd.close()
    }
}
