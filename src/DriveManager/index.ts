/*
 * @adonisjs/drive
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/// <reference path="../../adonis-typings/index.ts" />

import { Manager } from '@poppinss/manager'
import { RouterContract } from '@ioc:Adonis/Core/Route'
import { LoggerContract } from '@ioc:Adonis/Core/Logger'
import { Exception, ManagerConfigValidator } from '@poppinss/utils'
import { ApplicationContract } from '@ioc:Adonis/Core/Application'

import {
  DisksList,
  Visibility,
  DriveConfig,
  DriverContract,
  DriveFileStats,
  DriveFakeContract,
  LocalDriverConfig,
  DriveManagerContract,
  FakeImplementationCallback,
} from '@ioc:Adonis/Core/Drive'

/**
 * Drive manager exposes the API to resolve disks and extend by
 * adding custom drivers
 */
export class DriveManager
  extends Manager<
    ApplicationContract,
    DriverContract,
    DriverContract,
    { [P in keyof DisksList]: DisksList[P]['implementation'] }
  >
  implements DriveManagerContract
{
  /**
   * Find if drive is ready to be used
   */
  private isReady: boolean = false

  /**
   * The fake callback
   */
  private fakeCallback: FakeImplementationCallback = (_, disk, config) => {
    const { DriveFake } = require('../Fake')
    return new DriveFake(disk, config, this.router)
  }

  /**
   * Cache all disks instances
   */
  protected singleton = true

  /**
   * Reference to registered fakes
   */
  public fakes: Map<keyof DisksList, DriveFakeContract> = new Map()

  constructor(
    public application: ApplicationContract,
    public router: RouterContract,
    private logger: LoggerContract,
    private config: DriveConfig
  ) {
    super(application)
    this.validateConfig()
  }

  /**
   * Validate config
   */
  private validateConfig() {
    if (!this.config) {
      return
    }

    const validator = new ManagerConfigValidator(this.config, 'drive', 'config/drive')
    validator.validateDefault('disk')
    validator.validateList('disks', 'disk')

    this.isReady = true
  }

  /**
   * Returns the default mapping name
   */
  protected getDefaultMappingName() {
    return this.config.disk
  }

  /**
   * Returns config for a given mapping
   */
  protected getMappingConfig(diskName: keyof DisksList) {
    return this.config.disks[diskName]
  }

  /**
   * Returns the name of the drive used by a given mapping
   */
  protected getMappingDriver(diskName: keyof DisksList): string | undefined {
    return this.getMappingConfig(diskName)?.driver
  }

  /**
   * Make instance of the local driver
   */
  protected createLocal(diskName: keyof DisksList, config: LocalDriverConfig) {
    const { LocalDriver } = require('../Drivers/Local')
    return new LocalDriver(diskName, config, this.router)
  }

  /**
   * Fake default or a named disk
   */
  public fake(disk?: keyof DisksList) {
    disk = disk || this.getDefaultMappingName()

    if (!this.fakes.has(disk)) {
      this.logger.trace({ disk: disk }, 'drive faking disk')
      this.fakes.set(disk, this.fakeCallback(this, disk, this.getMappingConfig(disk)))
    }
  }

  /**
   * Restore the fake for the default or a named disk
   */
  public restore(disk?: keyof DisksList) {
    disk = disk || this.getDefaultMappingName()

    if (this.fakes.has(disk)) {
      this.logger.trace({ disk: disk }, 'drive restoring disk fake')
      this.fakes.delete(disk)
    }
  }

  /**
   * Restore all fakes1
   */
  public restoreAll() {
    this.fakes = new Map()
  }

  /**
   * Resolve instance for a disk
   */
  public use(disk?: keyof DisksList): any {
    if (!this.isReady) {
      throw new Exception(
        'Missing configuration for drive. Visit https://bit.ly/2WnR5j9 for setup instructions',
        500,
        'E_MISSING_DRIVE_CONFIG'
      )
    }

    disk = disk || this.getDefaultMappingName()
    if (this.fakes.has(disk)) {
      return this.fakes.get(disk)
    }

    return super.use(disk)
  }

  /**
   * Register a custom fake implementation
   */
  public setFakeImplementation(callback: FakeImplementationCallback) {
    this.fakeCallback = callback
  }

  /**
   * Returns the file contents as a buffer. The buffer return
   * value allows you to self choose the encoding when
   * converting the buffer to a string.
   */
  public async get(location: string, ...args: any[]): Promise<Buffer> {
    return this.use().get(location, ...args)
  }

  /**
   * Returns the file contents as a stream
   */
  public async getStream(location: string, ...args: any[]): Promise<NodeJS.ReadableStream> {
    return this.use().getStream(location, ...args)
  }

  /**
   * A boolean to find if the location path exists or not
   */
  public exists(location: string, ...args: any[]): Promise<boolean> {
    return this.use().exists(location, ...args)
  }

  /**
   * Returns the location path visibility
   */
  public async getVisibility(location: string, ...args: any[]): Promise<Visibility> {
    return this.use().getVisibility(location, ...args)
  }

  /**
   * Returns the location path stats
   */
  public async getStats(location: string, ...args: any[]): Promise<DriveFileStats> {
    return this.use().getStats(location, ...args)
  }

  /**
   * Returns a signed URL for a given location path
   */
  public getSignedUrl(location: string, ...args: any[]): Promise<string> {
    return this.use().getSignedUrl(location, ...args)
  }

  /**
   * Returns a URL for a given location path
   */
  public getUrl(location: string, ...args: any[]): Promise<string> {
    return this.use().getUrl(location, ...args)
  }

  /**
   * Write string|buffer contents to a destination. The missing
   * intermediate directories will be created (if required).
   */
  public put(location: string, ...args: any[]): Promise<void> {
    return this.use().put(location, ...args)
  }

  /**
   * Write a stream to a destination. The missing intermediate
   * directories will be created (if required).
   */
  public putStream(location: string, ...args: any[]): Promise<void> {
    return this.use().putStream(location, ...args)
  }

  /**
   * Not supported
   */
  public setVisibility(location: string, ...args: any[]): Promise<void> {
    return this.use().setVisibility(location, ...args)
  }

  /**
   * Remove a given location path
   */
  public delete(location: string, ...args: any[]): Promise<void> {
    return this.use().delete(location, ...args)
  }

  /**
   * Copy a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public copy(source: string, ...args: any[]): Promise<void> {
    return this.use().copy(source, ...args)
  }

  /**
   * Move a given location path from the source to the desination.
   * The missing intermediate directories will be created (if required)
   */
  public move(source: string, ...args: any[]): Promise<void> {
    return this.use().move(source, ...args)
  }
}
