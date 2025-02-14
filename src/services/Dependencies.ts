import { Commands } from './../constants/Commands';
import { Notifications } from './Notifications';
import { execSync } from 'child_process';
import { commands, ProgressLocation, ThemeIcon, window } from 'vscode';
import { Logger } from './Logger';
import { NpmLs, Subscription } from '../models';
import { Terminal } from './Terminal';
import { Extension } from './Extension';

const SUPPORTED_VERSIONS = ["16.13"];
const DEPENDENCIES = ["gulp-cli", "yo", "@microsoft/generator-sharepoint"];

export class Dependencies {

  public static registerCommands() {
    const subscriptions: Subscription[] = Extension.getInstance().subscriptions;

    subscriptions.push(
      commands.registerCommand(Commands.checkDependencies, Dependencies.validate)
    );
    subscriptions.push(
      commands.registerCommand(Commands.installDependencies, Dependencies.install)
    );
  }

  /**
   * Validate if all the required dependencies are installed
   */
  public static async validate() {
    await window.withProgress({
      location: ProgressLocation.Notification,
      cancellable: false,
      title: 'Checking dependencies',
    }, async (progress) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            progress.report({ message: 'Checking node version...' });

            // Validate node
            const isNodeValid = Dependencies.isValidNodeJs();
            if (!isNodeValid) {
              Notifications.warning(`Your Node.js version is not supported with SPFx development. Make sure you are using version: >=16.13 and <17.0`);
              resolve(null);
              return;
            }

            progress.report({ message: 'Checking npm dependencies...' });

            const command = `npm list -g --json --silent`;
            const result = execSync(command, { shell: Terminal.shell, timeout: 15000 });

            if (!result) {
              Notifications.error(`Failed checking dependencies`);
            }

            // Check for missing dependencies
            const npmLs: NpmLs = JSON.parse(result.toString());
            const missingDependencies = [];
            for (const dependency of DEPENDENCIES) {
              const dependencyResult = npmLs.dependencies[dependency];
              if (!dependencyResult) {
                missingDependencies.push(dependency);
              }
            }

            if (missingDependencies.length > 0) {
              const installItem = 'Install dependencies';
              Notifications.warning(`Missing dependencies: ${missingDependencies.join(', ')}`, installItem).then((item) => {
                if (item === installItem) {
                  commands.executeCommand(Commands.installDependencies);
                }
              })
            } else {
              Notifications.info('You have all dependencies installed and ready to go!');
            }
            resolve(null);
          } catch (e) {
            Notifications.error(`Failed checking dependencies`);
            Logger.error(`${(e as Error).message}`);
            resolve(null);
          }
        }, 0);
      });
    });
  }

  /**
   * Install all the dependencies
   */
  public static install() {
    const terminal = window.createTerminal({
      name: `Installing dependencies`,
      iconPath: new ThemeIcon('cloud-download')
    });

    if (terminal) {
      terminal.sendText(`npm i -g ${DEPENDENCIES.join(' ')}`);
      terminal.show(true);
    }
  }

  /**
   * Check node version
   */
  private static isValidNodeJs() {
    try {
      const output = execSync(`node --version`, { shell: Terminal.shell });
      const match = /v(?<major_version>\d+)\.(?<minor_version>\d+)\.(?<patch_version>\d+)/gm.exec(output.toString());

      Logger.info(`Node.js version: ${output}`);

      const npmOutput = execSync(`npm --version`, { shell: Terminal.shell });
      Logger.info(`npm version: ${npmOutput}`);

      if (!match) return false;
      
      let groups;
      const majorVersion = null === (groups = match.groups) || void 0 === groups ? void 0 : groups.major_version;
      const minorVersion = null === (groups = match.groups) || void 0 === groups ? void 0 : groups.minor_version;

      const supported = SUPPORTED_VERSIONS.find((version) => {
        const versionParts = version.split('.');
        const major = versionParts[0];
        const minor = versionParts[1];

        if (minor && minorVersion) {
          return majorVersion === major && minorVersion >= minor;
        }

        return majorVersion === major;
      });

      return !!supported;
    } catch(e) {
      Logger.error(`Failed checking node version: ${(e as Error).message}`);
      return false;
    }
  }
}