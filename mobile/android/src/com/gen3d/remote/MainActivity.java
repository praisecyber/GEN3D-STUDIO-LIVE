package com.gen3d.remote;
import android.app.Activity;
import android.os.Bundle;
import android.net.Uri;
import android.graphics.Color;
import android.view.View;
import android.view.inputmethod.InputMethodManager;
import android.content.Context;
import android.widget.*;
import android.webkit.*;
import org.json.JSONArray;
import org.json.JSONObject;
public class MainActivity extends Activity {
 private WebView web;private String origin="";
 @Override public void onCreate(Bundle saved){super.onCreate(saved);
  LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);layout.setPadding(16,16,16,0);layout.setBackgroundColor(Color.rgb(12,19,32));
  TextView title=new TextView(this);title.setText("GEN3D Remote · Desktop address");title.setTextColor(Color.WHITE);title.setTextSize(17);layout.addView(title);
  EditText address=new EditText(this);address.setTextColor(Color.WHITE);address.setSingleLine(true);address.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_URI);address.setHint("http://192.168.1.20:8787");address.setHintTextColor(Color.LTGRAY);address.setText(getPreferences(MODE_PRIVATE).getString("desktop",""));layout.addView(address);
  TextView status=new TextView(this);status.setTextColor(Color.LTGRAY);status.setText("Use the address shown in Projection Studio. Connect on the same local network.");
  Button connect=new Button(this);connect.setText("Open desktop remote");layout.addView(connect);Button offlineButton=new Button(this);offlineButton.setText("Offline library & KJV Bible");layout.addView(offlineButton);Button reload=new Button(this);reload.setText("Reload remote view");reload.setVisibility(View.GONE);reload.setOnClickListener(new View.OnClickListener(){@Override public void onClick(View v){recreate();}});layout.addView(reload);layout.addView(status);
  web=new WebView(this);WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(true);web.setBackgroundColor(Color.BLACK);
  web.setWebChromeClient(new WebChromeClient(){@Override public void onPermissionRequest(PermissionRequest request){request.deny();}});
  WebViewClient client=new WebViewClient(){@Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return !sameOrigin(request.getUrl());}@Override public void onPageFinished(WebView view,String url){if(url.startsWith("file:///android_asset/")){String snapshot=getPreferences(MODE_PRIVATE).getString("offline","");if(!snapshot.isEmpty())view.evaluateJavascript("localStorage.setItem('gen3d.remoteSnapshot',"+JSONObject.quote(snapshot)+");",null);status.setText("Offline KJV is available below. View saved offline copy to read previously saved desktop data.");}else status.setText("Enter the desktop PIN below. Use Save current data offline before opening the offline library.");}@Override public void onReceivedError(WebView view,WebResourceRequest req,WebResourceError error){if(req.isForMainFrame())status.setText("Cannot reach desktop. Check its address, Wi-Fi and firewall.");}};
  web.setWebViewClient(android.os.Build.VERSION.SDK_INT>=26?new RecoveringClient(client,new Runnable(){@Override public void run(){WebView old=web;web=null;if(old!=null){layout.removeView(old);old.destroy();}connect.setEnabled(false);offlineButton.setEnabled(false);reload.setVisibility(View.VISIBLE);status.setText("The Android web view stopped. Tap Reload remote view. If this repeats, update Android System WebView. Saved offline data remains on this device.");}}):client);
  layout.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(layout);
  connect.setOnClickListener(new View.OnClickListener(){@Override public void onClick(View v){String value=address.getText().toString().trim();if(!value.startsWith("http://")&&!value.startsWith("https://"))value="http://"+value;Uri uri=Uri.parse(value);if(uri.getHost()==null||uri.getUserInfo()!=null||!("http".equals(uri.getScheme())||"https".equals(uri.getScheme()))){status.setText("Enter a complete HTTP or HTTPS desktop address.");return;}origin=uri.getScheme()+"://"+uri.getAuthority();getPreferences(MODE_PRIVATE).edit().putString("desktop",origin).apply();status.setText("Connecting…");web.loadUrl(origin+"/");((InputMethodManager)getSystemService(Context.INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(address.getWindowToken(),0);}});offlineButton.setOnClickListener(new View.OnClickListener(){@Override public void onClick(View v){web.evaluateJavascript("(function(){try{return localStorage.getItem('gen3d.remoteSnapshot')||'';}catch(e){return '';}})()",new ValueCallback<String>(){@Override public void onReceiveValue(String value){try{String snapshot=new JSONArray("["+value+"]").getString(0);if(!snapshot.isEmpty())getPreferences(MODE_PRIVATE).edit().putString("offline",snapshot).apply();}catch(Exception ignored){}web.loadUrl("file:///android_asset/remote.html");}});}});web.loadUrl("file:///android_asset/remote.html");
 }
 @android.annotation.TargetApi(26)
 private static class RecoveringClient extends WebViewClient {
  private final WebViewClient base;private final Runnable recover;
  RecoveringClient(WebViewClient base,Runnable recover){this.base=base;this.recover=recover;}
  @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return base.shouldOverrideUrlLoading(view,request);}
  @Override public void onPageFinished(WebView view,String url){base.onPageFinished(view,url);}
  @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){base.onReceivedError(view,request,error);}
  @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){recover.run();return true;}
 }
 private boolean sameOrigin(Uri uri){return (uri.getScheme()+"://"+uri.getAuthority()).equals(origin);}
 @Override public void onBackPressed(){if(web!=null&&web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onDestroy(){if(web!=null){web.stopLoading();web.destroy();}super.onDestroy();}
}
