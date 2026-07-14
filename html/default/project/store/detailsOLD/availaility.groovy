package store;

import org.entermediadb.asset.MediaArchive
import org.entermediadb.google.GoogleManager
import org.entermediadb.projects.LibraryCollection
import org.openedit.Data
import org.openedit.MultiValued
import org.openedit.event.WebEvent
import org.openedit.users.User
import org.openinstitute.finance.DateRange
 

public void runit()
{
	//Search for dates
	if( context.getPageValue("aproduct") != null )
	{
		Data product = context.getPageValue("aproduct");
		log.info("On " + product);
        Date now = new Date();
        Date from = mediaarchive.getBean("dateStorageUtil").addDaysToDate(now,-31);

        
		Collection invoices = mediaarchive.query("collectiveinvoice").after("duedate",from).exact("productlist.productid",product.getId()).sort("duedate").search();
		context.putPageValue("invoices",invoices);
		DateRange range = new DateRange();
		for(Data invoice in invoices)
		{
			Date startDate = invoice.getDate("duedate");
			Date endDate = invoice.getDate("enddate");
			range.addBlockedDateRange(startDate, endDate);
		}
		log.info("Invoices " + invoices.size() + " " + invoices.getSearchQuery() + " show dates "+ range.getBlockedDates());
		context.putPageValue("blockeddates",range);
	}
}

runit();
