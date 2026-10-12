
/*
For Postfix just switch out 'vevcom@oemga.ntnu.no' with %s
*/

SELECT DISTINCT mainquery."email" FROM 
(
    -- Find the External addresses
    SELECT "MailAddressExternal"."address" as "email" FROM "MailAlias"
        INNER JOIN "MailAliasMailingList" ON "MailAlias"."id" = "MailAliasMailingList"."mailAliasId"
        INNER JOIN "MailingList" ON "MailAliasMailingList"."mailingListId" = "MailingList"."id"
        
        INNER JOIN "MailingListMailAddressExternal" ON "MailingList"."id" = "MailingListMailAddressExternal"."mailingListId"
        INNER JOIN "MailAddressExternal" ON "MailingListMailAddressExternal"."mailAddressExternalId" = "MailAddressExternal"."id"
        
        WHERE "MailAlias"."address" = '%s'

    -- Find the users
    UNION SELECT "User"."email" FROM "MailAlias"
        INNER JOIN "MailAliasMailingList" ON "MailAlias"."id" = "MailAliasMailingList"."mailAliasId"
        INNER JOIN "MailingList" ON "MailAliasMailingList"."mailingListId" = "MailingList"."id"

        INNER JOIN "MailingListUser" ON "MailingList"."id" = "MailingListUser"."mailingListId"
        INNER JOIN "User" ON "MailingListUser"."userId" = "User"."id"
        
        WHERE "MailAlias"."address" = '%s'
    
    -- Find the groups and the users inside the groups
    UNION SELECT "User"."email" FROM "MailAlias"
        INNER JOIN "MailAliasMailingList" ON "MailAlias"."id" = "MailAliasMailingList"."mailAliasId"
        INNER JOIN "MailingList" ON "MailAliasMailingList"."mailingListId" = "MailingList"."id"

        INNER JOIN "MailingListGroup" ON "MailingList"."id" = "MailingListGroup"."mailingListId"
        INNER JOIN "Group" ON "MailingListGroup"."groupId" = "Group"."id"
        INNER JOIN "Membership" ON "Group"."id" = "Membership"."groupId"
        INNER JOIN "User" ON "Membership"."userId" = "User"."id"
        
        WHERE "MailAlias"."address" = '%s' AND "Membership"."active" = true
    
) as mainquery
WHERE mainquery."email" IS NOT NULL;
    