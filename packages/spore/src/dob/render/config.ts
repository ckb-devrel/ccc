export type FileServerResult =
  | string
  | {
      content: string
      content_type: string
    }

export type BtcFsResult = FileServerResult
export type IpfsResult = FileServerResult

export type BtcFsURI = `btcfs://${string}`
export type IpfsURI = `ipfs://${string}`

export type QueryBtcFsFn = (uri: BtcFsURI) => Promise<BtcFsResult>
export type QueryIpfsFn = (uri: IpfsURI) => Promise<IpfsResult>
export type QueryUrlFn = (uri: string) => Promise<FileServerResult>

export class Config {
  private _dobDecodeServerURL = 'https://dob-decoder.rgbpp.io'
  private _queryBtcFsFn: QueryBtcFsFn = async (uri) => {
    return fetch(`https://api.omiga.io/api/v1/nfts/dob_imgs?uri=${uri}`).then(
      (res) => res.json(),
    )
  }

  private _queryUrlFn = async (url: string) => {   
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise<IpfsResult>((resolve, reject) => {
        const reader = new FileReader()
        // eslint-disable-next-line func-names
        reader.onload = function () {
          const base64 = this.result as string
          resolve(base64)
        }
        reader.onerror = (error) => {
          reject(error)
        }
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      throw error
    }
  }

  private _queryIpfsFn = async (uri: IpfsURI) => {
    const key = uri.substring('ipfs://'.length)
    const url = `https://ipfs.io/ipfs/${key}`
    return this._queryUrlFn(url)
  }

  get dobDecodeServerURL() {
    return this._dobDecodeServerURL
  }

  setDobDecodeServerURL(dobDecodeServerURL: string): void {
    this._dobDecodeServerURL = dobDecodeServerURL
  }

  setQueryBtcFsFn(fn: QueryBtcFsFn): void {
    this._queryBtcFsFn = fn
  }

  setQueryIpfsFn(fn: QueryIpfsFn): void {
    this._queryIpfsFn = fn
  }

  get queryBtcFsFn(): QueryBtcFsFn {
    return this._queryBtcFsFn
  }

  get queryIpfsFn(): QueryIpfsFn {
    return this._queryIpfsFn
  }

  get queryUrlFn(): QueryUrlFn {
    return this._queryUrlFn
  }
}

export const config = new Config()
