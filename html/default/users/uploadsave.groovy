package importing;

import org.entermediadb.asset.*;
import org.openedit.OpenEditException
import org.openedit.profile.UserProfile
import org.openedit.users.*;


public void init2()
{
	MediaArchive archive = context.getPageValue("mediaarchive");
	Collection assets = context.getPageValue("assets");
	if( assets != null)
	{
		Asset onefile = assets.iterator().next();
		User edituser =  context.getPageValue("selecteduser");
		String username = context.getUserName();
		if( username == null || edituser == null || !edituser.getId().equals(username))
		{
			throw new OpenEditException("No permission to edit user");
		}
		UserProfile profile = archive.getUserProfile(edituser.getId());
		profile.setValue("assetportrait",onefile.getId());
		archive.saveData("userprofile",profile);
		if( edituser.getId().equals(  context.getUser().getId() ) )
		{
				String catalogid = context.findValue("catalogid");
				context.putSessionValue(catalogid + "user",edituser);
				context.putPageValue("user",edituser);
		}
	}	
}

init2();


