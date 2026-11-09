export default {
    getDeviceVersion: 0x27,
    getBatteryLevel: 0x13,
    getTime: 0x41,
    setTime: 0x01,
    getUserProfile: 0x42,
    setUserProfile: 0x02,
    clearData: 0x61,
    getDailyActivitySummaryHistory: 0x51,
    getDetailedActivityHistory: 0x52,
    getDetailedHRHistory: 0x54, // seems not to work always?
    getHRHistory: 0x55,
    getName: 0x3e,
    getMACAddress: 0x22,
    setAutoMode: 0x2a,
    getAutoMode: 0x2b,
    getHRVHistory: 0x56,
    getTemperatureHistory: 0x65, // 0x62, seems not to work
    getSPO2History: 0x66,
    getSleeepHistory: 0x53,
    // live ECG + PPG streaming (SDK: OpenECGPPG / stopEcgPPg / GetEcgPpgStatus)
    startECGPPG: 0x99, // starts ECG + PPG raw streaming for a given duration, replies with status
    stopECGPPG: 0x98, // stops streaming, echoed back (also sent by the watch when it stops on its own)
    getECGPPGStatus: 0x9c,
    ecgQuality: 0x83, // periodic HR, HRV, signal quality during streaming
    ecgRaw: 0xaa, // raw ECG samples, big-endian int16
    ppgRaw: 0xab // raw PPG samples, big-endian int16
}
