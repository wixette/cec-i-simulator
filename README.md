<p align="center"><img src="images/logo.svg" alt="中华学习机模拟器的标志" width="96"></p>

# 中华学习机模拟器 · CEC-I Simulator

[![Tests](https://github.com/wixette/cec-i-simulator/actions/workflows/test.yml/badge.svg)](https://github.com/wixette/cec-i-simulator/actions/workflows/test.yml)

**在浏览器里 3D 再现 1987 年的 CEC-I 中华学习机。** 你可以开机、编写 BASIC 程序、输入汉字，还可以把机器拆开，看看一台 8 位电脑是怎样显示成千上万个汉字的。

**[▶ 在线试用](https://wixette.github.io/cec-i-simulator/)**：无需安装，电脑和手机上都能用，界面有简体中文和英文两种。

> **English:** The CEC-I 中华学习机 (China Educational Computer, 1987) was China's school computer: an Apple IIe compatible with the whole GB 2312 Chinese character set in two font chips on its main board. This simulator runs its own ROMs in your browser, in 3D, with its TV and its keyboard. **[Read the English README](README.en.md).**

![模拟器：中华学习机和它的电视机，屏幕上是一段汉字 BASIC 程序的运行结果，下方是课程面板](screenshots/app.jpg)

> 这是预发布版（v0.0.5），已经有六节简短的课程、“程序”菜单里的十六个示例程序（游戏、汉字、音乐、LOGO 等）、机器下方演示工作原理的四个仪表，还有一台软盘驱动器，可以运行你自己找来的 Apple II 磁盘。更多语言将在以后的版本中加入（见[路线图](design/roadmap.md)）。

## 中华学习机是什么？

1984 年，邓小平提出“计算机的普及要从娃娃做起”。清华大学牵头的联合设计组为此研制了 **CEC-I 中华学习机**，1987 年推出。它与 Apple IIe 兼容，主机和键盘做在同一个机壳里，用家里的电视机当显示器，需要保存程序时再接软盘驱动器或录音机，售价约 960 元。在全国各地中小学的计算机教室里，许多学生在它上面写下了自己的第一个程序。

它最大的特点是能处理汉字。同时代的电脑大多只认识 96 个英文字母和符号，而中华学习机把国家标准字符集 GB 2312 中的 7445 个汉字和符号，以 16 × 16 点阵的形式存放在主板上的两片字库芯片里。按一下“中文”键，就能进入汉字系统，不需要软盘。

本模拟器按照真机，一个部件一个部件地再现了这台机器：

| | 中华学习机 | 模拟器 |
|---|---|---|
| 处理器 | 6502，约 1.02 MHz | 同样的 6502，每条指令的周期数都准确，通过了全部 151 万个 SingleStepTests 测试 |
| ROM | 系统 ROM（监控程序、CEC-BASIC、LOGO）、汉字系统 ROM、两片字库、字符发生器、键盘 ROM | 一台能正常工作的学习机上的全套 ROM（见 [roms/NOTICE](roms/NOTICE)） |
| 内存 | 64 KB（48 KB 主存加上语言卡的 16 KB），没有辅助内存 | 相同 |
| 汉字 | GB 2312 中的全部 7445 个汉字和符号；拼音和区位码输入 | 相同，运行的就是它自己的汉字系统 |
| 显示 | 接电视机或监视器：40 × 24 的文本，低分辨率和高分辨率彩色图形 | 一台八十年代的彩色电视机，也可以换成黑白电视机或绿色单色显示器 |
| 声音 | 内置喇叭，`MUSIC` 语句 | 相同 |
| 外存储器 | 5.25 英寸软盘驱动器（与 Disk II 兼容，接在 6 号槽口），或者录音机 | 软盘驱动器，支持 `.dsk`、`.do`、`.po`、`.nib` 和 `.woz` 磁盘映像；没有录音机 |
| 没有模拟 | 打印机 | |

## 上手几分钟

1. **打开模拟器。** 学习机和电视机已经开机，屏幕上依次出现 `ZHONG HUA XUE XI JI` 和 `VERSION 1.1`，然后是 BASIC 的提示符 `]`。
2. **输入** `PRINT "HELLO"`，按回车，学习机就会显示 HELLO。
3. **按“中文”键**（你的键盘上是 Page Up，或 Alt-Z），启动汉字系统。按“西文”键（Page Down，或 Alt-X）返回西文状态。
4. **输入汉字程序：** 点“程序 ▸ 输入文字”，粘贴一段带汉字的 BASIC 程序，再点“输入”。模拟器会用学习机自带的区位码输入法，一个键一个键地替你打进去。
5. **玩游戏：** 点“程序 ▸ 游戏 ▸ 贪吃蛇”，再点“输入并运行”，然后用方向键控制蛇。
6. **跟着课程学：** 机器下方的“课程”标签里有六节简短的课程，从开机讲起，一直讲到处理器内部。
7. **拆开看看：** 先关机，再在 3D 视角菜单中选“拆开”。

**你的键盘可以当学习机的键盘用。** 字母、数字和符号键的位置都一样；学习机特有的键对应如下：

| 学习机的键 | 你的键盘 | 或者 |
|---|---|---|
| 中文 | Page Up | Alt-Z |
| 西文 | Page Down | Alt-X |
| F1–F5 | F1–F5 | Alt-1 … Alt-5 |
| Quit | F6 | Alt-Q |
| Test | End | Alt-T |
| Reset | F12 | Alt-R |
| ◁ | Backspace | ← |

Ctrl-Reset 对应 Ctrl-F12。在手机上，请切换到 2D 视图，用屏幕上的键盘输入。

## 模拟器能做什么

- **3D 和 2D 两种视图：** 3D 视图有正面、侧前方、键盘、屏幕、背面、内部和拆开七个视角；2D 视图里电视机画面大而清晰，键盘像抽屉一样可以拉出来。
- **运行学习机自带的软件：** 西文 BASIC、汉字系统（拼音和区位码输入）、LOGO、监控程序和小汇编，还有开机自检（Ctrl-Reset-TEST）。
- **输入、打开和保存程序：** 粘贴的文字会被一个键一个键地“打”进学习机，汉字通过区位码输入；BASIC 程序可以保存成文本文件，里面的汉字仍然是汉字。LOGO 的过程也能保存成文件，以后再打开。
- **插入磁盘：** 在“程序 ▸ 磁盘”中插入 `.dsk`、`.do`、`.po`、`.nib` 或 `.woz` 磁盘映像（也可以直接把文件拖到页面上），就能像当年一样从磁盘启动 DOS 3.3、ProDOS 和各种游戏；写到磁盘上的内容，可以再保存成文件带走。磁盘软件需要你自己准备，本项目不提供。
- **更换显示设备和外观：** 可以接彩色电视机、黑白电视机或绿色单色显示器；机壳可以是崭新的样子，也可以是如今泛黄的样子。

学习机的四本原始手册已经整理成数字版，见 [cec-i-docs](https://github.com/wixette/cec-i-docs) 项目。

---

## 开发者

在本地运行（无需构建）：

```
git clone https://github.com/wixette/cec-i-simulator.git
cd cec-i-simulator
python3 -m http.server 8000
```

然后在浏览器中打开 <http://localhost:8000/>。运行检查需要 Node.js 和 pnpm：

```
pnpm install
pnpm check            # 单元测试、严格类型检查，以及引用和链接检查（CI 运行的就是这些）
pnpm test:browser     # 在无界面的 Chrome 中测试页面
```

更多文档（英文）：[开发说明](docs/development.md)、[代码约定](docs/conventions.md)、[界面设计](docs/ui-design.md)、[设计决定](design/decisions.md)、[路线图](design/roadmap.md)、[3D 模型](model/README.md)、[学习机的工作原理和实测数据](research/README.md)、[参与贡献](CONTRIBUTING.md)、[隐私](docs/privacy.md)。

## 许可证

- 代码使用 [Apache License 2.0](LICENSE)。
- 3D 模型、文档、照片和研究笔记使用 [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt)。
- `roms/` 中的 ROM 不属于本项目，版权归学习机的制造者所有，作为历史文物收录；来源见 [roms/NOTICE](roms/NOTICE)。权利人如有要求，我们会立即删除。
- 第三方材料保留各自的许可证：three.js（MIT）、字体（OFL 1.1）、图标（Apache-2.0），见 [docs/licensing.md](docs/licensing.md) 和 `REUSE.toml`。

本项目与中华学习机的设计者和制造者没有关系。

## 致谢

- [cec-i-docs](https://github.com/wixette/cec-i-docs)：中华学习机四本手册的数字版，是本模拟器的主要依据。
- MAME 的中华学习机驱动和 ROM，用来对照检验。
- Tom Harte 的 [SingleStepTests](https://github.com/SingleStepTests/65x02)，用来检验 6502 的每一条指令。
- [three.js](https://threejs.org/)，以及思源黑体和思源宋体（Noto Sans SC、Noto Serif SC）。
- 界面设计沿用了作者的 [TRS-80 模拟器](https://github.com/wixette/trs-80-simulator)。
