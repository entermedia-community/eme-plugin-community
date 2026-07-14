package store;

import org.openedit.Data
import org.openinstitute.finance.DateRange
 

public void runit()
{
	String invoiceid = context.getRequestParameter("invoiceid");
	
	
	//Search for dates
	if( invoiceid != null )
	{
		Data invoicedata = mediaarchive.getData("collectiveinvoice",invoiceid);
		ArrayList products = (ArrayList)invoicedata.getValue("productlist");
		String productid = products.get(0).productid;
		Data product = mediaarchive.getData("collectiveproduct",productid);
		if ( product == null)
        {
            return;
        }
		log.info("On " + product);
        Date now = new Date();
        Date from = mediaarchive.getBean("dateStorageUtil").addDaysToDate(now,-31);

        
		Collection invoices = mediaarchive.query("collectiveinvoice")
								.after("duedate",from).not("paymentstatus","canceled")
								.exact("productlist.productid",product.getId())
								.sort("duedate")
								.search();
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
