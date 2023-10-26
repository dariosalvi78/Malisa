let motion = {
  callback: undefined,
  startTS: 0,
  motionHandler (event) {
    let simplifiedEvent = {
      msFromStart: new Date().getTime() - this.startTS,
      acc: {
        x: event.acceleration.x,
        y: event.acceleration.y,
        z: event.acceleration.z
      },
      accG: {
        x: event.accelerationIncludingGravity.x,
        y: event.accelerationIncludingGravity.y,
        z: event.accelerationIncludingGravity.z
      },
      rotRate: {
        alpha: event.rotationRate.alpha,
        beta: event.rotationRate.beta,
        gamma: event.rotationRate.gamma
      },
      interval: event.interval
    }
    this.callback(simplifiedEvent)
  },

  isAvailable () {
    if (typeof DeviceMotionEvent !== 'undefined') return true
    else return false
  },

  async requestPermission () {
    if (typeof (DeviceMotionEvent.requestPermission) === 'function') {
      return DeviceMotionEvent.requestPermission()
    } else return Promise.resolve(true)
  },

  startNotifications (cbk) {
    this.callback = cbk
    this.startTS = new Date().getTime()
    this.motionHandler = this.motionHandler.bind(this)
    window.addEventListener('devicemotion', this.motionHandler, false)
  },

  stopNotifications () {
    window.removeEventListener('devicemotion', this.motionHandler)
    this.callback = null
  }
}

export default motion 