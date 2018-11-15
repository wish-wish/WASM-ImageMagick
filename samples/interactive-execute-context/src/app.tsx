import pmap from 'p-map'
import * as React from 'react'
import { style } from 'typestyle'
import {
  arrayToCli, buildImageSrc, cliToArray, ExecutionContext, extractInfo, getBuiltInImages, getInputFilesFromHtmlInputElement,
  MagickFile, MagickInputFile,
} from 'wasm-imagemagick'

export interface AppProps {
  context: ExecutionContext
}

export interface AppState {
  commandString: string
  commandArray: string
  jsonError: string
  files: MagickInputFile[]
  imgSrcs: string[]
  outputFileSrcs: string[]
  outputFiles: MagickFile[]
  showImagesAndInfo: boolean
  filesInfo: any[]
  builtInImagesAdded: boolean
  stdout: string
  stderr: string
  exitCode: number
}

export class App extends React.Component<AppProps, AppState> {

  state: AppState = {
    commandString: '',
    commandArray: '[]',
    jsonError: '',
    files: [],
    imgSrcs: [],
    outputFileSrcs: [],
    outputFiles: [],
    showImagesAndInfo: false,
    filesInfo: [],
    builtInImagesAdded: false,
    stdout: '',
    stderr: '',
    exitCode: 0,
  }

  protected styles = {
    textarea: style({
      width: '100%',
    }),
    infoTextarea: style({
      width: '400px',
      height: '160px',
    }),
    stdioTextarea: style({
      width: '100%',
      height: '160px',
    }),
    imagesList: style({
      height: '500px',
      overflowY: 'scroll',
    }),
    executionBad: style({
      backgroundColor: '#ff8888',
    }),
    executionGood: style({
      backgroundColor: '#88ff88',
    }),
  }

  render(): React.ReactNode {
    return (
      <div>
        <div>
          <h4>Images available (#{this.state.files.length}) :</h4>
          <div>Show images and info: <input type='checkbox' checked={this.state.showImagesAndInfo} onChange={this.showImagesAndInfoChange.bind(this)}></input></div>

          <div><button onClick={this.addBuiltInImages.bind(this)} disabled={this.state.builtInImagesAdded}>Add built-in images</button></div>

          <div><label>Add images: <input title='Add images' type='file' onChange={this.addImagesInputChanged.bind(this)}></input></label>  </div>

          <ul className={(this.state.showImagesAndInfo || '') && this.styles.imagesList}>{this.state.files.map((f, i) =>
            <li>
              <table>
                <thead><tr><th>Name</th><th>Image</th><th>Info</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{f.name}</td>
                    <td>{(this.state.showImagesAndInfo || '') &&
                      <img alt={f.name} src={this.state.imgSrcs[i]}></img>}</td>
                    <td>{(this.state.showImagesAndInfo || '') &&
                      <textarea className={this.styles.infoTextarea} value={JSON.stringify(this.state.filesInfo[i][0].image, null, 2)}></textarea>}</td>
                  </tr>
                </tbody>
              </table>
            </li>)}
          </ul>
        </div>
        <div>Command (String syntax):
          <textarea className={this.styles.textarea} onChange={this.commandStringChange.bind(this)} value={this.state.commandString}></textarea>
        </div>
        <div>Command (Array syntax):
          <textarea className={this.styles.textarea} onChange={this.commandArrayChange.bind(this)} value={this.state.commandArray}></textarea>
          {(this.state.jsonError || '') && <div>Execution error: {this.state.jsonError} <br />See browser console for more information.</div>}
        </div>
        <div>
          <button onClick={this.execute.bind(this)}>Execute</button>
        </div>
        {(this.state.outputFiles.length || '') &&
          <div>
            <ul>{this.state.outputFiles.map((f, i) =>
              <li><div>{f.name}</div>
                <img src={this.state.outputFileSrcs[i]}></img>
              </li>,
            )}
            </ul>
          </div>}
        <h5><span className={this.state.exitCode ? this.styles.executionBad : this.styles.executionGood}>Exit code: {this.state.exitCode + ''}</span></h5>
        <h5>stdout:</h5>
        <textarea className={this.styles.stdioTextarea} value={this.state.stdout}></textarea>
        <h5>stderr:</h5>
        <textarea className={this.styles.stdioTextarea} value={this.state.stderr}></textarea>
      </div>)
  }

  protected commandStringChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const commandArray = JSON.stringify(cliToArray(e.target.value)) // TODO: validate
    this.setState({ ...this.state, commandString: e.target.value, commandArray })
  }

  protected async addBuiltInImages() {
    if (!this.state.builtInImagesAdded) {
      const builtIn = await getBuiltInImages()
      await this.addInputFiles(builtIn)
      this.setState({ ...this.state, builtInImagesAdded: true })
    }
  }

  protected async execute() {
    const result = await this.props.context.execute(this.state.commandString)
    this.state.outputFiles = result.outputFiles
    this.state.stderr = result.stderr.join('\n')
    this.state.stdout = result.stdout.join('\n')
    this.state.exitCode = result.exitCode
    await this.updateImages()
  }

  protected commandArrayChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const commandArray = e.target.value
    let jsonError = ''
    let commandString = this.state.commandString
    try {
      commandString = arrayToCli(JSON.parse(e.target.value))
    } catch (error) {
      jsonError = error + ''
    }
    this.setState({ ...this.state, commandString, commandArray, jsonError })
  }

  protected async addImagesInputChanged(e: React.ChangeEvent<HTMLInputElement>) {
    const inputFiles = await getInputFilesFromHtmlInputElement(e.target)
    this.addInputFiles(inputFiles)
  }

  protected async addInputFiles(files: MagickInputFile[]) {
    this.props.context.addFiles(files)
    await this.updateImages()
  }

  protected async updateImages() {
    const files = await this.props.context.getAllFiles()
    const imgSrcs = this.state.showImagesAndInfo ? await pmap(files, f => buildImageSrc(f, true)) : this.state.imgSrcs
    const filesInfo = this.state.showImagesAndInfo ? await pmap(files, f => extractInfo(f)) : this.state.filesInfo
    const outputFileSrcs = await pmap(this.state.outputFiles, f => buildImageSrc(f, true))
    this.setState({ ...this.state, files, imgSrcs, outputFileSrcs, filesInfo })
  }

  protected async showImagesAndInfoChange(e: React.ChangeEvent<HTMLInputElement>) {
    this.state.showImagesAndInfo = e.target.checked
    await this.updateImages()
  }

}