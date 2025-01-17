import plugin from '../../../lib/plugins/plugin.js'
import os from 'os'
import { Cfg } from '../components/index.js'
import lodash from 'lodash'
import Error from '../model/error.js'

// 命令规则
let notGroup = Cfg.get('memory.group', []) // 不更新群名片的群组，需要手动设置，具体加群了解
let nikename = '' // 机器人名字，留空为昵称
let cd = 0
let fix = 2 // 数据保留几位小数
/**
 * 使用说明：本V3插件为自动更新群名片插件
 * 命令：#系统占用 查看目前系统占用
 * #更新群名片 手动更新机器人群名片，默认每分钟自动执行一次
====== * **/
export class Memory extends plugin {
  constructor () {
    super({
      name: '系统占用',
      dsc: '检测系统占用',
      event: 'message',
      priority: 1709,
      rule: [{
        reg: '^#*系统占用$',
        fnc: 'SI'
      }, {
        reg: '^#*更新群名片',
        fnc: 'setGroupCard'
      }]
    })
    this.task = {
      cron: '30 * * * * ?',
      name: '自动群名片',
      fnc: () => this.CardTask()
    }
    Object.defineProperty(this.task, 'log', { get: () => false })
  }

  mapToArr (map) {
    let allGroup = []
    map.forEach((v, k) => { allGroup.push(k) })
    return allGroup
  }

  async CardTask () {
    if (await redis.get('flower:safe-ban-cd')) return true
    let cdi = Cfg.get('card.hz', 1)
    if (!cdi) { return true } else if (cd++ < cdi) { return true } else { cd = 0 }
    let nowPerMem = await this.getPerMem()
    let taskGroup = lodash.difference(this.mapToArr(Bot.gl), notGroup)

    if (taskGroup.length) { for (let groupId of taskGroup) { await this.setGroupCard(groupId, nowPerMem, true) } }
    return true
  }

  async setGroupCard (groupId, percentNum, isTask = false) {
    if (!isTask) {
      await Bot.pickGroup(await this.e.group_id).setCard(Bot.uin, `${nikename || Bot.nickname}｜当前内存占用${await this.getPerMem()}%`)
      logger.info(`【更新群名片】更新了群${groupId}的群名片`)
      return true
    }
    try {
      await Bot.pickGroup(groupId).setCard(Bot.uin, `${nikename || Bot.nickname}｜当前内存占用${percentNum}%`)
    } catch (e) {
      logger.error(Error.getErrorByCode(101))
      console.log(e)
      await redis.set('flower:safe-ban-cd', 'TRUE', { EX: 3600 * 6 })
    }
  }

  getPerMem () {
    const totalMem = os.totalmem(); const freeMem = os.freemem()
    return ((1 - freeMem / totalMem) * 100).toFixed(fix).toString()
  }

  async SI () {
    if (!this.e.isMaster) { return this.e.reply('w(ﾟДﾟ)w你没有权限哦！') }
    let dealMem = (mem) => {
      let G = 0; let M = 0; let KB = 0;
      (mem > (1 << 30)) && (G = (mem / (1 << 30)).toFixed(2));
      (mem > (1 << 20)) && (mem < (1 << 30)) && (M = (mem / (1 << 20)).toFixed(2));
      (mem > (1 << 10)) && (mem > (1 << 20)) && (KB = (mem / (1 << 10)).toFixed(2))
      return G > 0 ? G + 'G' : M > 0 ? M + 'M' : KB > 0 ? KB + 'KB' : mem + 'B'
    }
    const arch = os.arch(); const kernel = os.type(); const pf = os.platform(); const totalMem = os.totalmem(); const freeMem = os.freemem(); const cpu = os.cpus()
    let memoryUsePer = ((process.memoryUsage().rss / totalMem) * 100).toFixed(fix).toString()
    let CpuNumber = cpu.length; let AllHz = 0; let AllCpu = 0; let CpuSerialnNumber = 0; let times
    while (CpuNumber--) {
      times = cpu[CpuSerialnNumber].times
      AllCpu += cpu[CpuSerialnNumber].speed * ((1 - times.idle / (times.idle + times.user + times.nice + times.sys + times.irq)))
      AllHz += cpu[CpuSerialnNumber++].speed
    }
    let msg = ['-----操作系统信息-----',
      '\n系统内核：' + kernel,
      '\n平台：' + pf,
      '\n--------内存信息--------',
      '\n内存大小：' + dealMem(totalMem) + '\n空闲内存：' + dealMem(freeMem),
      `\n内存使用：${dealMem(process.memoryUsage().rss)}` + `\n内存使用率：${memoryUsePer}%`,
      '\n------处理器信息------',
      `\n共有${CpuSerialnNumber}个cpu核心,架构为${arch}\n`,
      `CPU综合占用率${(AllCpu / AllHz * 100).toFixed(fix).toString()}%`]
    return this.reply(msg, true)
  }
}
