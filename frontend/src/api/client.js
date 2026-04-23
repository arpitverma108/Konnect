const delay = (ms) => new Promise(res => setTimeout(res, ms))

export const fakeApi = async (data, time = 500) => {
  await delay(time)
  return data
}