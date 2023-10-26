let orientation = {

  callback: undefined,
  startTS: 0,

  orientationHandler (event) {
    let simplifiedEvent = {
      msFromStart: new Date().getTime() - this.startTS,
      abs: event.absolute,
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma
    }
    if (event.webkitCompassHeading) simplifiedEvent.heading = event.webkitCompassHeading
    if (event.webkitCompassAccuracy) simplifiedEvent.acc = event.webkitCompassAccuracy
    this.callback(simplifiedEvent)
  },

  isAvailable () {
    if (typeof DeviceOrientationEvent !== 'undefined') return true
    else return false
  },
  async requestPermission () {
    if (typeof (DeviceOrientationEvent.requestPermission) === 'function') {
      return DeviceOrientationEvent.requestPermission()
    }
    return Promise.resolve(true)
  },
  startNotifications (cbk) {
    this.callback = cbk
    this.startTS = new Date().getTime()
    this.orientationHandler = this.orientationHandler.bind(this)
    window.addEventListener('deviceorientation', this.orientationHandler, false)
  },
  stopNotifications () {
    window.removeEventListener('deviceorientation', this.orientationHandler)
    this.callback = null
  }
}

export default orientation 