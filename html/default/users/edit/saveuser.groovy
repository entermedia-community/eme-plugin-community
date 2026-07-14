package users;

import org.entermediadb.asset.*;
import org.openedit.data.Searcher
import org.openedit.profile.UserProfile
import org.openedit.users.*;


public void init2()
{
	MediaArchive archive = context.getPageValue("mediaarchive");
	
	//Save profile
	Searcher profilesearcher = archive.getSearcher("userprofile");
	
	String[] profiledetails = ["sendchatnotifications", "assetportrait"];

	//get this users profile and only this user
	String userid = context.getRequestParameter("userid");	

	UserProfile profile = archive.getUserProfile(userid);
	profilesearcher.updateData(context, profiledetails, profile);
	archive.saveData("userprofile",profile);
	
	
	//Save user 
	String[] userdetails2 = ["lastName","firstName","email"];
	Searcher usersearcher = archive.getSearcher("user");
	User auser = archive.getUser(userid);
	usersearcher.updateData(context, userdetails2, auser);
	archive.saveData("user",auser);
	
	if( userid == context.getUserName() )
	{
		log.info("Update login");
		context.putSessionValue(archive.getCatalogId() + "user", auser);
		context.putPageValue("user",auser);
		context.putPageValue("userprofile",profile);
		
	}
	
	
}

init2();


