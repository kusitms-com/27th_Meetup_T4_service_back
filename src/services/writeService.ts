import { PrismaClient } from '@prisma/client'
import { DATA_SOURCES } from '../config/auth';
import { TemplateDTO } from '../interfaces/DTO';
import mysql from 'mysql2/promise';
import { getKoreanDateISOString } from '../modules/koreanTime';
const prisma = new PrismaClient();




const newChallengeData = async (user_id: number, newChallenge: string) => {
    try {
        const [userCooponDB, challengesCountDB, challengesOverlapDB] = await Promise.all([
            prisma.users.findUnique({
                where: {
                    user_id: user_id
                },
                select: {
                    coopon: true
                }
            }),
            prisma.user_challenges.aggregate({
                where: {
                    user_id: user_id
                },
                _count: {
                    uchal_id: true
                }
            }),
            prisma.challenges.findMany({
                where: {
                    title: newChallenge
                },
                select: {
                    user_challenges: {
                        where: {
                            user_id: user_id
                        },
                        select: {
                            chal_id: true
                        }
                    }
                }
            })
        ]);
        const coopon = userCooponDB?.coopon;
        const challengesCount = challengesCountDB._count.uchal_id;
        const challengesOverlap = challengesOverlapDB[0].user_challenges[0];
        prisma.$disconnect();
        return {
            coopon,
            challengesCount,
            challengesOverlap
        }

    } catch (error) {
        prisma.$disconnect();
        console.log(error);
    }
};

const startChallengeData = async (user_id: number, newChallenge: string) => {
    try {
        const chalId = await prisma.challenges.findMany({
            where: {
                title: newChallenge
            },
            select: {
                chal_id: true
            }
        });
        const chalIdData = chalId[0].chal_id;
        await prisma.user_challenges.create({
            data: {
                user_id: user_id,
                chal_id: chalIdData
            }
        });
        prisma.$disconnect();
        return { chalIdData, newChallenge };

    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return false;
    }
};

const newChallengeResult = async (user_id: number, challenge_id: number, newChallenge: string) => {
    try {
        const koreanDateISOString = getKoreanDateISOString();
        const koreanTime = new Date(koreanDateISOString);
        console.log(koreanTime);
        const challengTemplateArray: {
            category: string;
            "template-title": string;
            "template-content": string;
        }[] = [];
        const relativeChallengeArray = [];

        const [challengTemplateDB, relativeChallengeDB1, relativeChallengeDB2] = await Promise.all([
            prisma.challenges.findMany({
                where: {
                    chal_id: challenge_id
                },
                select: {
                    title: true,
                    category: {
                        select: {
                            name: true
                        },
                    },
                    templates: {
                        select: {
                            title: true,
                            content: true
                        }
                    }
                }
            }),
            prisma.user_challenges.findMany({
                where: {
                    user_id: user_id
                },
                select: {
                    challenges: {
                        select: {
                            title: true
                        }
                    },
                    user_challenge_templetes: {
                        where: {
                            created_at: koreanTime,
                            NOT: {
                                complete: true,
                            }


                        },
                        select: {
                            uctem_id: true
                        }
                    }
                }
            }),
            prisma.user_challenges.findMany({
                where: {
                    user_id: user_id
                },
                select: {
                    challenges: {
                        select: {
                            title: true
                        }
                    },
                    user_challenge_templetes: {
                        where: {
                            created_at: koreanTime,
                        },
                        select: {
                            uctem_id: true
                        }
                    }
                }
            }),
        ]);
        console.log(relativeChallengeDB1);
        console.log(relativeChallengeDB2);
        for (var i = 0; i < challengTemplateDB[0].templates.length; i++) {
            const challengTemplate = challengTemplateDB.map((e) => {
                return [{
                    "template-title": e.templates[i].title,
                    "template-content": e.templates[i].content,
                    "category": e.category.name,
                }]
            });
            //     console.log(challengTemplate)
            challengTemplateArray.push(challengTemplate[0][0]);
        }

        for (var i = 0; i < relativeChallengeDB1.length; i++) {
            const relativeChallengeMap = relativeChallengeDB1.map((e) => {
                return e.challenges;
            });
            relativeChallengeArray.push(relativeChallengeMap[i].title);

        }
        for (var i = 0; i < relativeChallengeDB2.length; i++) {
            if (!relativeChallengeDB2[i].user_challenge_templetes[0]) {
                const relativeChallengeMap = relativeChallengeDB1.map((e) => {
                    return e.challenges;
                });
                relativeChallengeArray.push(relativeChallengeMap[i].title);
            }
        }


        console.log(relativeChallengeArray)

        const valueFilter = relativeChallengeArray.filter((element) => element !== newChallenge);
        valueFilter.unshift(newChallenge);
        prisma.$disconnect();
        return { valueFilter, challengTemplateArray };
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
    }
};


const writeChallengeData = async (user_id: number) => {
    try {
        const date = new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' });
        const isoDate = new Date(date).toISOString().slice(0, 10) + "T00:00:00.000Z";
        const realDate = new Date(isoDate);
        const challengeCategoryDB =
            await prisma.user_challenges.findMany({
                where: {
                    user_id: user_id
                },
                select: {
                    chal_id: true,
                    challenges: {
                        select: {
                            title: true,
                        }
                    },
                    user_challenge_templetes: {
                        where: {
                            OR: {
                                created_at: realDate,
                                NOT: {
                                    complete: true
                                }
                            }
                        },
                        select: {
                            uctem_id: true
                        }
                    }
                }
            });
        prisma.$disconnect();
        return { challengeCategoryDB }
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
    }
};

const writeTemplateData = async (chal_id: number, uctem_id?: number) => {
    try {
        if (!uctem_id) {
            var [challengeTemplateDB, categoryDB] = await Promise.all([
                prisma.templates.findMany({
                    where: {
                        chal_id: chal_id
                    },
                    select: {
                        title: true,
                        content: true,
                    }
                }),
                prisma.challenges.findMany({
                    where: {
                        chal_id: chal_id
                    },
                    select: {
                        category: {
                            select: {
                                name: true
                            }
                        }
                    }
                }),
            ]);
            prisma.$disconnect();
            return { challengeTemplateDB, categoryDB };
        }
        else {
            var [challengeTemplateDB, categoryDB, userTemplateDB] = await Promise.all([
                prisma.templates.findMany({
                    where: {
                        chal_id: chal_id
                    },
                    select: {
                        title: true,
                        content: true,
                    }
                }),
                prisma.challenges.findMany({
                    where: {
                        chal_id: chal_id
                    },
                    select: {
                        category: {
                            select: {
                                name: true
                            }
                        }
                    }
                }),
                prisma.user_challenge_templetes.findMany({
                    where: {
                        uctem_id: uctem_id
                    },
                    select: {
                        title: true,
                        writing: true,
                        templates: {
                            select: {
                                title: true
                            }
                        },
                        user_challenges: {
                            select: {
                                challenges: {
                                    select: {
                                        title: true
                                    }
                                }
                            }
                        }


                    }
                }),
            ]);
            const userTemplate = userTemplateDB.map((e) => {
                return {
                    "title": e.title,
                    "writing": e.writing,
                    "templates": e.templates.title,
                    "user_challenges": e.user_challenges.challenges.title
                }

            })
            const userTemplates = userTemplate[0]
            console.log(userTemplates)

            prisma.$disconnect();
            return { challengeTemplateDB, categoryDB, userTemplates };
        }
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
    }
};

const insertTemporaryChallengeData = async (
    user_id: number,
    challengeName: string,
    templateName: string,
    challengeTitle: string,
    challengeContent: string
) => {
    try {

        const [challengeIdDB, templateIdDB] = await Promise.all([
            prisma.challenges.findMany({
                where: {
                    title: challengeName
                },
                select: {
                    chal_id: true
                }
            }),
            prisma.templates.findMany({
                where: {
                    title: templateName
                },
                select: {
                    tem_id: true
                }
            })
        ]);
        const userChallengeDB =
            await prisma.user_challenges.findMany({
                where: {
                    user_id: user_id,
                    chal_id: challengeIdDB[0].chal_id
                },
                select: {
                    uchal_id: true
                }
            });
        console.log(userChallengeDB);
        const challengeSignDB = await prisma.user_challenge_templetes.findMany({
            where: {
                uchal_id: userChallengeDB[0].uchal_id,
                tem_id: templateIdDB[0].tem_id,
            },
            select: {
                uctem_id: true
            }
        });
        if (!challengeSignDB) {
            await prisma.user_challenge_templetes.create({
                data: {
                    uchal_id: userChallengeDB[0].uchal_id,
                    tem_id: templateIdDB[0].tem_id,
                    title: challengeTitle,
                    writing: challengeContent,
                    complete: false
                }
            });
        } else {
            await prisma.user_challenge_templetes.updateMany({
                where: {
                    uchal_id: userChallengeDB[0].uchal_id,
                    tem_id: templateIdDB[0].tem_id
                },
                data: {
                    title: challengeTitle,
                    writing: challengeContent
                }
            });
        }
        prisma.$disconnect();
        return true;
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return false;
    }
};

const insertChallengeCompleteData = async (
    user_id: number,
    challengeName: string,
    templateName: string,
    challengeTitle: string,
    challengeContent: string
) => {
    try {
        const [challengeIdDB, templateIdDB] = await Promise.all([
            prisma.challenges.findMany({
                where: {
                    title: challengeName
                },
                select: {
                    chal_id: true
                }
            }),
            prisma.templates.findMany({
                where: {
                    title: templateName
                },
                select: {
                    tem_id: true
                }
            })
        ]);
        const userChallengeDB =
            await prisma.user_challenges.findMany({
                where: {
                    user_id: user_id,
                    chal_id: challengeIdDB[0].chal_id
                },
                select: {
                    uchal_id: true
                }
            });
        console.log(userChallengeDB);
        const challengeSignDB = await prisma.user_challenge_templetes.findMany({
            where: {
                uchal_id: userChallengeDB[0].uchal_id,
                tem_id: templateIdDB[0].tem_id,
            },
            select: {
                uctem_id: true
            }
        });
        if (!challengeSignDB) {
            await prisma.user_challenge_templetes.create({
                data: {
                    uchal_id: userChallengeDB[0].uchal_id,
                    tem_id: templateIdDB[0].tem_id,
                    title: challengeTitle,
                    writing: challengeContent,
                    complete: true
                }
            });
        } else {
            await prisma.user_challenge_templetes.updateMany({
                where: {
                    uchal_id: userChallengeDB[0].uchal_id,
                    tem_id: templateIdDB[0].tem_id
                },
                data: {
                    title: challengeTitle,
                    writing: challengeContent,
                    complete: true
                }
            });
        }
        prisma.$disconnect();
        return true;
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return false;
    }
};

const selectTemplateData = async (
    challengeName: string
) => {
    try {
        const resultArray = [];
        const challengeIdCategoryDB =
            await prisma.challenges.findMany({
                where: {
                    title: challengeName
                },
                select: {
                    chal_id: true,
                    category: {
                        select: {
                            name: true
                        }
                    }
                }
            });

        const templateNameDB: TemplateDTO[] =
            await prisma.templates.findMany({
                where: {
                    chal_id: challengeIdCategoryDB[0].chal_id
                },
                select: {
                    title: true,
                    content: true
                }
            });



        for (var i = 0; i < templateNameDB.length; i++) {
            const category = challengeIdCategoryDB.map((e) => {
                return { "category": e.category.name };
            });

            templateNameDB[i].category = category[0].category;
        }
        //   console.log(templateNameDB)

        prisma.$disconnect();
        return templateNameDB;
    } catch (error) {
        console.log(error);
        prisma.$disconnect();
        return false;
    }
};







export {
    newChallengeData, startChallengeData, newChallengeResult,
    writeChallengeData, writeTemplateData, insertTemporaryChallengeData,
    insertChallengeCompleteData, selectTemplateData
}