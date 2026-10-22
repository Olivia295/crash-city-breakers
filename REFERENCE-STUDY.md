# Burnout CRASH! 实况对照记录

本轮重做参考：[Vizzed Gameplay Videos — Burnout Crash! (Xbox 360))](https://www.youtube.com/watch?v=UHqeogB11Lk)，时长 56:28。通过浏览器播放器观看并停帧核对。下面只记录实际读到的画面，未把未观看的片段或音频记成已验证。

## 直接画面观察

| 时间 | 画面证据 | 对当前实现的要求 |
|---|---|---|
| 0:02 | 车辆选择页为黑色星纹背景、斜切银边卡片；B-Team Van 蓝色车卡；Crashbreaker Power 红箭头、Aftertouch 黄箭头 | 深色街机车库；把爆破力度与残骸操控的差异做清楚 |
| 3:12 | Road Trip 提示：表现特别好时可能出现 Bank Truck | 运钞车是有规则的奖励事件，不是任意货车换皮 |
| 3:32 | Windrush 十字路口，横竖道路，近垂直俯视。左上 TRAFFIC 61 LEFT + 阶段箭头 + 五个 X；右上金色美元数字/星级；左下爆破槽 | 镜头和 HUD 重新布局；有限车流与逃脱失败必须进入规则层 |
| 3:42 | 玩家残骸旁出现绿色 A；左下橙色满槽、Press A to EXPLODE；左上建筑已缺损 | 手动触发满槽爆破；建筑必须改变轮廓 |
| 4:07 | 5x EXPLOSION COMBO $500,000；一个逃脱 X 变红 | 大额连锁奖励与逃脱是不同反馈 |
| 约 4:42–5:12 | 阶段图标由带光环车变为磁铁；车流数字下降，路面持续留下黑色焦痕 | 临时 Feature、持久焦痕；光环图标的具体意义仅凭该画面不确定 |
| 6:52 | 龙卷风终局，镜头更近；上方显示龙卷风图标和奖金；房屋剩下墙体、屋内地板，浅色碎片散落街边 | 独立终局阶段、可识别龙卷风、房屋逐步崩塌与瓦砾 |
| 9:37 | Pizza of Fortune：画面暗下，中央芝士披萨分区轮盘、上方指针；结果 Magnet!；轮盘还能看到速度牌和 ×2 | 披萨车触发事件轮盘；轮盘显示模拟层已决定的结果 |
| 11:17 | Rush Hour 结算逐行列出 CRASHES、EXPLOSIONS、逃脱、BEST CHAIN 和金额 | 结算区分交通、财产、奖金；不只报一个总分 |
| 16:56 | Rush Hour 剩 11 秒；左上蓝色机械计时器，右上星级和金色分数；多栋楼成为残墙 | 各模式 HUD 有差异；计时模式不显示五叉失败条件 |
| 22:35 | 冷色商业区双向分隔大道，停车场、广告牌、公交残骸；不是每张地图都采用十字路口 | 原片地图多样性明确；本轮当前街区不应宣称覆盖原作所有关卡 |
| 28:14 | Skywing & 2nd Road Trip 说明页：三星分数门槛，另两星为触发 Super Feature 和完成 Dunk Skillshot | 五星应由分数与技巧任务共同组成；当前当地挑战需准确命名 |
| 33:52 | 机场交叉口有弯曲匝道、冷色建筑、水边轮廓；出现 Explosion Chain 与很大的拆楼奖金 | 不同来源的连锁应有不同标签和真实奖励 |
| 39:31 | 结算六类：CRASHES、EXPLOSIONS、COMBOS、DEMOLITIONS、SKILLSHOTS、FEATURES；技巧最高记录 47 yd | 距离技巧和建筑破坏是独立可理解的目标，而不是同一串浮字 |
| 45:10 | Terminal 3 分隔道路、候车雨棚、沿街栏杆；中央通道可作为残骸活动空间 | 原作具体布局与本地街区不同，不能把三条入场线宣传为三张地图 |
| 50:49 | Skywing & 3rd 同一地点列 Road Trip/Rush Hour/Pile Up，各自记录星级 | 模式与单人/双人参与方式应分开 |
| 51:39、52:09 | Pile Up 左上显示剩余交通与 ×4/×3 倍率，没有 Road Trip 的五叉 | 使用模式对应的 HUD 和倍率状态 |
| 52:19 | No more traffic! ×3 INFERNO! Keep the FIRES burning! 中央横幅 | 有限车流全部处理后再进入 Inferno，不能仅定时结束 |
| 52:29 | 左上火焰菱形倒计时 0，中央 Crash Complete | 燃烧阶段明确结束，再到成绩页 |

## 交叉核实的规则

- [主创 Richard Franke 的访谈](https://gameinformer.com/games/burnout_crash/b/ps3/archive/2011/08/03/what-39-s-the-scoop-on-burnout-crash.aspx)：Road Trip 五次无伤逃脱失败；Rush Hour 90 秒、披萨卡车/随机 Feature/终场大爆破；Pile Up 有限车流结束后进入 Inferno。
- [Criterion 制作人说明](https://blog.playstation.com/2011/09/20/burnout-crash-explodes-onto-psn-today/)：可破坏建筑、Smash Chain、Explosion Combo/Chain、阻碍玩家的推土机。
- [GameSpot 当年实测](https://www.gamespot.com/reviews/burnout-crash-review/1900-6335579/)：Crashbreaker 自动慢充，碰撞使充能加快；救护车安全离开消除一个逃脱叉；Good Cops 封路。
- [Jeuxvideo 当年预览](https://www.jeuxvideo.com/articles/0001/00015430-burnout-crash-gc-2011-preview.htm)：磁吸作用于玩家车辆，并非专门的磁铁卡车。
- [玩家机制资料](https://burnout.fandom.com/wiki/Burnout_CRASH%21)：运钞车钱袋、导弹车、冰淇淋车、六种 Super Feature。上述细节使用二手资料补充，精确参数未核验。

## 本地调校与差异必须明确

有限车流总数、每次充能量、碰撞伤害、各建筑血量、货币门槛、特效时长均为本地调校；不是从原版代码提取的精确参数。原作成品模型、纹理、音乐、台词没有从视频提取，使用本项目独立制作的资产。不得把重做结果描述为已经像素级或全内容一致。

旧样机存档位于 `archive/reference-rebuild/`，用于对照回归。
